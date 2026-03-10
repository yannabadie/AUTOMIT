import os
import json
import uuid
from datetime import datetime, timedelta, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Use Kestra's PostgreSQL (same instance, different schema)
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://kestra:kestra_secret@postgres:5432/kestra")


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def init_schema():
    """Create automit schema and tables if not exist."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE SCHEMA IF NOT EXISTS automit")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS automit.audit_receipts (
                    receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    action_id VARCHAR(255) NOT NULL,
                    target_type VARCHAR(100) NOT NULL,
                    target_id VARCHAR(255) NOT NULL,
                    target_display_name VARCHAR(500),
                    requestor_glpi_user_id INTEGER NOT NULL,
                    requestor_profile VARCHAR(100),
                    requestor_entity VARCHAR(100),
                    tier SMALLINT NOT NULL DEFAULT 0,
                    result VARCHAR(50) NOT NULL,
                    details JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS automit.cooldown_entries (
                    id SERIAL PRIMARY KEY,
                    action_id VARCHAR(255) NOT NULL,
                    target_id VARCHAR(255) NOT NULL,
                    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_cooldown_action_target
                ON automit.cooldown_entries (action_id, target_id, executed_at)
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS automit.system_state (
                    key VARCHAR(100) PRIMARY KEY,
                    value JSONB NOT NULL DEFAULT '{}',
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                INSERT INTO automit.system_state (key, value)
                VALUES ('emergency_stop', '{"active": false}'::jsonb)
                ON CONFLICT (key) DO NOTHING
            """)
            conn.commit()
    finally:
        conn.close()


# --- Audit Receipts ---

class AuditReceiptCreate(BaseModel):
    action_id: str
    target_type: str
    target_id: str
    target_display_name: str = ""
    requestor_glpi_user_id: int
    requestor_profile: str = ""
    requestor_entity: str = ""
    tier: int = 0
    result: str  # success, failure, partial
    details: dict = {}


@router.post("/audit/receipts")
def create_receipt(body: AuditReceiptCreate):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            receipt_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO automit.audit_receipts
                (receipt_id, action_id, target_type, target_id, target_display_name,
                 requestor_glpi_user_id, requestor_profile, requestor_entity, tier, result, details)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING receipt_id, created_at
            """, (receipt_id, body.action_id, body.target_type, body.target_id,
                  body.target_display_name, body.requestor_glpi_user_id,
                  body.requestor_profile, body.requestor_entity, body.tier,
                  body.result, json.dumps(body.details)))
            row = cur.fetchone()
            conn.commit()
            return {"receipt_id": row["receipt_id"], "created_at": row["created_at"].isoformat()}
    finally:
        conn.close()


@router.get("/audit/receipts/{action_id}")
def get_receipt_by_action(action_id: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT * FROM automit.audit_receipts WHERE action_id = %s
                ORDER BY created_at DESC LIMIT 1
            """, (action_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Receipt not found")
            return dict(row)
    finally:
        conn.close()


@router.get("/audit/log")
def get_audit_log(limit: int = 50):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT * FROM automit.audit_receipts
                ORDER BY created_at DESC LIMIT %s
            """, (min(limit, 200),))
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


# --- Cooldowns ---

@router.post("/cooldowns/record")
def record_cooldown(body: dict):
    action_id = body.get("action_id", "")
    target_id = body.get("target_id", "")
    if not action_id or not target_id:
        raise HTTPException(status_code=400, detail="action_id and target_id required")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO automit.cooldown_entries (action_id, target_id)
                VALUES (%s, %s)
            """, (action_id, target_id))
            conn.commit()
        return {"recorded": True}
    finally:
        conn.close()


@router.get("/cooldowns/check")
def check_cooldown(action_id: str, target_id: str, min_interval_seconds: int = 900, max_per_hour: int = 4):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Check minimum interval
            cur.execute("""
                SELECT executed_at FROM automit.cooldown_entries
                WHERE action_id = %s AND target_id = %s
                ORDER BY executed_at DESC LIMIT 1
            """, (action_id, target_id))
            last = cur.fetchone()
            now = datetime.now(timezone.utc)
            if last:
                elapsed = (now - last["executed_at"]).total_seconds()
                if elapsed < min_interval_seconds:
                    wait = int(min_interval_seconds - elapsed)
                    return {"allowed": False, "reason": f"Cooldown: wait {wait}s"}

            # Check rate limit
            one_hour_ago = now - timedelta(hours=1)
            cur.execute("""
                SELECT COUNT(*) as cnt FROM automit.cooldown_entries
                WHERE action_id = %s AND target_id = %s AND executed_at > %s
            """, (action_id, target_id, one_hour_ago))
            count = cur.fetchone()["cnt"]
            if count >= max_per_hour:
                return {"allowed": False, "reason": f"Rate limit: max {max_per_hour}/hour"}

        return {"allowed": True}
    finally:
        conn.close()


# --- Emergency Stop ---

@router.get("/state/emergency-stop")
def get_emergency_stop():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM automit.system_state WHERE key = 'emergency_stop'")
            row = cur.fetchone()
            return row["value"] if row else {"active": False}
    finally:
        conn.close()


@router.post("/state/emergency-stop")
def set_emergency_stop(body: dict):
    active = body.get("active", True)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO automit.system_state (key, value, updated_at)
                VALUES ('emergency_stop', %s::jsonb, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """, (json.dumps({"active": active}),))
            conn.commit()
        return {"active": active}
    finally:
        conn.close()
