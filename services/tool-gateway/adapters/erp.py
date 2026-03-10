import os
import re
import httpx
import yaml
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

CEGID_MCP_URL = os.environ.get("CEGID_MCP_URL", "")
CEGID_MCP_TOKEN = os.environ.get("CEGID_MCP_TOKEN", "")

# Load job registry
_registry_path = Path(__file__).parent.parent / "registry" / "job_registry.yml"
try:
    with open(_registry_path) as f:
        JOB_REGISTRY: dict = yaml.safe_load(f).get("jobs", {})
except FileNotFoundError:
    JOB_REGISTRY = {}

SAFE_NAME = re.compile(r"^[A-Za-z0-9_\-]{1,128}$")


async def mcp_call(tool: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            CEGID_MCP_URL,
            json={
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": tool, "arguments": params},
                "id": 1,
            },
            headers={
                "Content-Type": "application/json",
                "X-MCP-TOKEN": CEGID_MCP_TOKEN,
            },
        )
        resp.raise_for_status()
        return resp.json().get("result", {})


@router.get("/jobs")
async def list_jobs():
    return {"jobs": JOB_REGISTRY}


@router.get("/job/{job_id}/status")
async def get_job_status(job_id: str):
    if job_id not in JOB_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not in registry")
    if not SAFE_NAME.match(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    if not CEGID_MCP_URL:
        return {
            "job_id": job_id,
            "registry": JOB_REGISTRY[job_id],
            "db_status": "MCP not configured",
        }

    sql = f"SELECT name, enabled FROM msdb.dbo.sysjobs WHERE name = N'{job_id}'"
    result = await mcp_call("query_database", {"sql": sql})
    return {"job_id": job_id, "registry": JOB_REGISTRY[job_id], "db_status": result}


@router.post("/job/{job_id}/restart")
async def restart_job(job_id: str):
    """Tier 2 — blocked until Phase 5 governance is in place."""
    raise HTTPException(
        status_code=403,
        detail=(
            f"Job restart for '{job_id}' is a Tier 2 action"
            " — blocked until Phase 5 governance"
        ),
    )
