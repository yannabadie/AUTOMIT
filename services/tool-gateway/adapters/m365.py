import asyncio
import os
import httpx
from fastapi import APIRouter

router = APIRouter()

AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "")
AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID", "")
AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET", "")
GRAPH_URL = "https://graph.microsoft.com/v1.0"


async def get_graph_token() -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token",
            data={
                "client_id": AZURE_CLIENT_ID,
                "client_secret": AZURE_CLIENT_SECRET,
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def graph_get_all(url: str, headers: dict) -> list:
    """Follow @odata.nextLink with Retry-After throttling."""
    results: list = []
    async with httpx.AsyncClient(timeout=30) as client:
        while url:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "60"))
                await asyncio.sleep(min(retry_after, 120))
                continue
            resp.raise_for_status()
            data = resp.json()
            results.extend(data.get("value", []))
            url = data.get("@odata.nextLink")
    return results


@router.get("/users")
async def list_users():
    if not AZURE_TENANT_ID:
        return {"count": 0, "users": [], "error": "Azure not configured"}
    token = await get_graph_token()
    headers = {"Authorization": f"Bearer {token}"}
    users = await graph_get_all(
        f"{GRAPH_URL}/users?$select=id,displayName,mail,accountEnabled&$top=100",
        headers,
    )
    return {"count": len(users), "users": users}


@router.get("/user/{user_id}")
async def get_user(user_id: str):
    if not AZURE_TENANT_ID:
        return {"error": "Azure not configured"}
    token = await get_graph_token()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{GRAPH_URL}/users/{user_id}?$select=id,displayName,mail,accountEnabled",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


@router.get("/risky-signins")
async def list_risky_signins():
    if not AZURE_TENANT_ID:
        return {"count": 0, "risky_users": [], "error": "Azure not configured"}
    token = await get_graph_token()
    headers = {"Authorization": f"Bearer {token}"}
    risky = await graph_get_all(
        f"{GRAPH_URL}/identityProtection/riskyUsers?$filter=riskState eq 'atRisk'&$top=50",
        headers,
    )
    return {"count": len(risky), "risky_users": risky}
