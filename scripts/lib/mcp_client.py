"""Shared MCP client and Graph API utilities for Kestra flows."""

import json
import requests
from typing import Any


def mcp_call(mcp_url: str, mcp_token: str, tool_name: str, arguments: dict, timeout: int = 30) -> Any:
    """Call an MCP tool via JSON-RPC."""
    headers = {
        "X-MCP-TOKEN": mcp_token,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    payload = {
        "jsonrpc": "2.0", "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    }
    resp = requests.post(mcp_url, json=payload, headers=headers, timeout=timeout)
    if resp.status_code == 200:
        data = resp.json()
        if "error" in data:
            raise Exception(f"MCP error: {data['error']}")
        return data.get("result", data)
    raise Exception(f"HTTP {resp.status_code}: {resp.text[:300]}")


def mcp_query(mcp_url: str, mcp_token: str, sql: str, limit: int = 100) -> Any:
    """Execute a read-only SQL query via MCP query_database tool."""
    return mcp_call(mcp_url, mcp_token, "query_database", {"sql": sql, "limit": limit})


def parse_mcp_query_result(result: Any) -> list:
    """Extract rows from MCP query_database response."""
    if isinstance(result, dict) and "content" in result:
        for item in result["content"]:
            if item.get("type") == "text":
                data = json.loads(item["text"]) if isinstance(item["text"], str) else item["text"]
                if isinstance(data, dict) and "rows" in data:
                    return data["rows"]
                elif isinstance(data, list):
                    return data
                return [data]
    return []


def get_graph_token(tenant: str, client_id: str, client_secret: str) -> str:
    """Obtain a Microsoft Graph API access token via client_credentials flow."""
    resp = requests.post(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials"
        }, timeout=30
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def send_graph_email(access_token: str, service_mailbox: str, subject: str,
                     html_body: str, recipients: list) -> bool:
    """Send an email via Graph API Mail.Send. Returns True if sent (HTTP 202)."""
    to_list = [{"emailAddress": {"address": addr}} for addr in recipients if addr]
    resp = requests.post(
        f"https://graph.microsoft.com/v1.0/users/{service_mailbox}/sendMail",
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        json={
            "message": {
                "subject": subject,
                "body": {"contentType": "HTML", "content": html_body},
                "toRecipients": to_list
            },
            "saveToSentItems": "true"
        }, timeout=30
    )
    return resp.status_code == 202
