import hashlib
import os
import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

GLPI_URL = os.environ.get("GLPI_URL", "http://localhost:80")
GLPI_APP_TOKEN = os.environ.get("GLPI_APP_TOKEN", "")
GLPI_USER_TOKEN = os.environ.get("GLPI_USER_TOKEN", "")


async def get_session() -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{GLPI_URL}/apirest.php/initSession",
            headers={
                "App-Token": GLPI_APP_TOKEN,
                "Authorization": f"user_token {GLPI_USER_TOKEN}",
            },
        )
        resp.raise_for_status()
        return resp.json()["session_token"]


async def kill_session(session: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.get(
                f"{GLPI_URL}/apirest.php/killSession",
                headers={"App-Token": GLPI_APP_TOKEN, "Session-Token": session},
            )
    except Exception:
        pass


@router.get("/ticket/{ticket_id}")
async def get_ticket_context(ticket_id: int):
    session = await get_session()
    headers = {"App-Token": GLPI_APP_TOKEN, "Session-Token": session}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{GLPI_URL}/apirest.php/Ticket/{ticket_id}", headers=headers
            )
            resp.raise_for_status()
            ticket = resp.json()

            resp_fu = await client.get(
                f"{GLPI_URL}/apirest.php/Ticket/{ticket_id}/ITILFollowup",
                headers=headers,
            )
            followups = resp_fu.json() if resp_fu.status_code == 200 else []

            # Fetch requester name
            requester_id = ticket.get("users_id_recipient", 0)
            requester_name = ""
            if requester_id:
                try:
                    resp_user = await client.get(
                        f"{GLPI_URL}/apirest.php/User/{requester_id}",
                        headers=headers,
                    )
                    if resp_user.status_code == 200:
                        requester_name = resp_user.json().get("name", "")
                except Exception:
                    pass

            # Fetch linked assets
            linked_assets = []
            try:
                resp_items = await client.get(
                    f"{GLPI_URL}/apirest.php/Ticket/{ticket_id}/Item_Ticket",
                    headers=headers,
                )
                if resp_items.status_code == 200:
                    items = resp_items.json()
                    if isinstance(items, list):
                        linked_assets = [
                            {"type": it.get("itemtype", ""), "id": it.get("items_id", 0), "name": it.get("itemtype", "")}
                            for it in items
                        ]
            except Exception:
                pass
    finally:
        await kill_session(session)

    content_str = f"{ticket.get('name', '')}{ticket.get('content', '')}"
    ticket_hash = hashlib.sha256(content_str.encode()).hexdigest()[:16]

    return {
        "ticket_id": ticket_id,
        "title": ticket.get("name", ""),
        "description": ticket.get("content", ""),
        "status": ticket.get("status", 0),
        "urgency": ticket.get("urgency", 3),
        "impact": ticket.get("impact", 3),
        "priority": ticket.get("priority", 3),
        "requester": {"id": requester_id, "name": requester_name},
        "followups": [
            {
                "id": fu.get("id", 0),
                "content": fu.get("content", ""),
                "is_private": bool(fu.get("is_private", 0)),
                "author": str(fu.get("users_id", "")),
                "date": fu.get("date_creation", ""),
            }
            for fu in (followups if isinstance(followups, list) else [])
        ],
        "linked_assets": linked_assets,
        "ticket_hash": ticket_hash,
    }


@router.post("/ticket/{ticket_id}/followup")
async def add_followup(ticket_id: int, body: dict):
    session = await get_session()
    headers = {
        "App-Token": GLPI_APP_TOKEN,
        "Session-Token": session,
        "Content-Type": "application/json",
    }

    payload = {
        "input": {
            "items_id": ticket_id,
            "itemtype": "Ticket",
            "content": body.get("content", ""),
            "is_private": 1 if body.get("is_private", True) else 0,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{GLPI_URL}/apirest.php/ITILFollowup",
                headers=headers,
                json=payload,
            )
    finally:
        await kill_session(session)

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail="Failed to create followup")
    return resp.json()
