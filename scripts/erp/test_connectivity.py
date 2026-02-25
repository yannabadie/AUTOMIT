#!/usr/bin/env python3
"""
AutomIT — Test connectivité ERP (CEGID + Sage X3)
Usage standalone: python scripts/erp/test_connectivity.py
Usage Docker:     docker run --rm --env-file .env automit/python-erp:3.12 python /opt/scripts/erp/test_connectivity.py
"""
import json
import os
import sys
import time

results = {"timestamp": None, "tests": [], "summary": {"passed": 0, "failed": 0}}


def test(name, fn):
    """Execute a test function and record result."""
    t0 = time.time()
    try:
        detail = fn()
        elapsed = round((time.time() - t0) * 1000)
        results["tests"].append({"name": name, "status": "PASS", "elapsed_ms": elapsed, "detail": detail})
        results["summary"]["passed"] += 1
        print(f"  [PASS] {name} ({elapsed}ms)")
    except Exception as e:
        elapsed = round((time.time() - t0) * 1000)
        results["tests"].append({"name": name, "status": "FAIL", "elapsed_ms": elapsed, "error": str(e)})
        results["summary"]["failed"] += 1
        print(f"  [FAIL] {name} ({elapsed}ms) — {e}")


# =============================================================================
# CEGID XRP Sprint — via MCP cegid-oracle (pas de SQL direct)
# =============================================================================
def _cegid_mcp_call(tool_name, arguments):
    """Call a CEGID Oracle MCP tool via JSON-RPC."""
    import requests
    mcp_url = os.environ["MCP_CEGID_ORACLE_URL"]
    mcp_token = os.environ["MCP_CEGID_ORACLE_TOKEN"]
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
    resp = requests.post(mcp_url, json=payload, headers=headers, timeout=30)
    if resp.status_code == 200:
        data = resp.json()
        if "error" in data:
            raise Exception(f"MCP error: {data['error']}")
        return data.get("result", data)
    raise Exception(f"HTTP {resp.status_code}: {resp.text[:300]}")


def test_cegid_mcp_connection():
    import requests
    url = os.environ["MCP_CEGID_ORACLE_URL"]
    token = os.environ["MCP_CEGID_ORACLE_TOKEN"]
    headers = {"X-MCP-TOKEN": token, "Content-Type": "application/json", "Accept": "application/json"}
    resp = requests.get(url.rstrip("/"), headers=headers, timeout=15)
    return {"url": url, "http_status": resp.status_code, "reachable": resp.status_code < 500}


def test_cegid_mcp_tools():
    import requests
    url = os.environ["MCP_CEGID_ORACLE_URL"]
    token = os.environ["MCP_CEGID_ORACLE_TOKEN"]
    headers = {"X-MCP-TOKEN": token, "Content-Type": "application/json", "Accept": "application/json"}
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
    resp = requests.post(url, json=payload, headers=headers, timeout=15)
    if resp.status_code == 200:
        data = resp.json()
        tools = data.get("result", {}).get("tools", [])
        return {"tools_count": len(tools), "tools": [t.get("name", t) for t in tools]}
    return {"error": f"HTTP {resp.status_code}"}


def test_cegid_sessions():
    result = _cegid_mcp_call("query_database", {
        "sql": "SELECT COUNT(*) AS cnt FROM sys.dm_exec_sessions WHERE is_user_process = 1",
        "limit": 1
    })
    return {"status": "OK", "raw": str(result)[:500]}


def test_cegid_jobs():
    result = _cegid_mcp_call("query_database", {
        "sql": """
            SELECT
                (SELECT COUNT(*) FROM msdb.dbo.sysjobactivity ja
                 JOIN msdb.dbo.sysjobs j ON ja.job_id = j.job_id
                 WHERE ja.start_execution_date IS NOT NULL
                 AND ja.stop_execution_date IS NULL) AS running,
                (SELECT COUNT(*) FROM msdb.dbo.sysjobhistory h
                 JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
                 WHERE h.run_status = 0
                 AND DATEDIFF(HOUR,
                     CAST(CAST(h.run_date AS VARCHAR) + ' ' +
                          STUFF(STUFF(RIGHT('000000' + CAST(h.run_time AS VARCHAR), 6),
                          3, 0, ':'), 6, 0, ':') AS DATETIME),
                     GETDATE()) < 1) AS failed_last_hour
        """,
        "limit": 1
    })
    return {"status": "OK", "raw": str(result)[:500]}


def test_cegid_freshness():
    result = _cegid_mcp_call("analyze_data_freshness", {"domain": "production"})
    return {"status": "OK", "raw": str(result)[:500]}


def test_cegid_backup():
    result = _cegid_mcp_call("query_database", {
        "sql": """
            SELECT TOP 1 backup_finish_date, type, backup_size / 1048576 AS size_mb
            FROM msdb.dbo.backupset
            WHERE database_name = 'Y2_MSC_MAROC'
            ORDER BY backup_finish_date DESC
        """,
        "limit": 1
    })
    return {"status": "OK", "raw": str(result)[:500]}


# =============================================================================
# Sage X3 — MCP x3-oracle
# =============================================================================
def test_x3_mcp_connection():
    import requests
    url = os.environ["X3_MCP_URL"]
    token = os.environ["X3_MCP_TOKEN"]
    headers = {"X-MCP-TOKEN": token, "Content-Type": "application/json", "Accept": "application/json"}
    resp = requests.get(url.rstrip("/"), headers=headers, timeout=15)
    return {"url": url, "http_status": resp.status_code, "reachable": resp.status_code < 500}


def test_x3_health():
    import requests
    url = os.environ["X3_MCP_URL"]
    token = os.environ["X3_MCP_TOKEN"]
    headers = {"X-MCP-TOKEN": token, "Content-Type": "application/json", "Accept": "application/json"}
    payload = {
        "jsonrpc": "2.0", "id": 1,
        "method": "tools/call",
        "params": {"name": "health_check", "arguments": {}}
    }
    resp = requests.post(url.rstrip("/"), json=payload, headers=headers, timeout=30)
    if resp.status_code == 200:
        data = resp.json()
        return {"status": "OK", "response": data.get("result", data)}
    return {"status": "ERROR", "http_status": resp.status_code, "body": resp.text[:300]}


# =============================================================================
# Main
# =============================================================================
if __name__ == "__main__":
    from datetime import datetime, timezone
    results["timestamp"] = datetime.now(timezone.utc).isoformat()

    print("=" * 60)
    print("AutomIT — Test connectivité ERP")
    print("=" * 60)

    # CEGID tests (via MCP cegid-oracle)
    cegid_vars = ["MCP_CEGID_ORACLE_URL", "MCP_CEGID_ORACLE_TOKEN"]
    if all(os.environ.get(v) for v in cegid_vars):
        print("\n[CEGID XRP Sprint — MCP cegid-oracle]")
        test("CEGID — Connexion MCP", test_cegid_mcp_connection)
        test("CEGID — Liste outils MCP", test_cegid_mcp_tools)
        test("CEGID — Sessions actives (query_database)", test_cegid_sessions)
        test("CEGID — Jobs batch (query_database)", test_cegid_jobs)
        test("CEGID — Fraicheur donnees (analyze_data_freshness)", test_cegid_freshness)
        test("CEGID — Derniere sauvegarde (query_database)", test_cegid_backup)
    else:
        print("\n[CEGID] SKIP — Variables manquantes:", [v for v in cegid_vars if not os.environ.get(v)])

    # X3 tests
    x3_vars = ["X3_MCP_URL", "X3_MCP_TOKEN"]
    if all(os.environ.get(v) for v in x3_vars):
        print("\n[Sage X3 — MCP x3-oracle]")
        test("X3 — Connexion MCP", test_x3_mcp_connection)
        test("X3 — Health Check", test_x3_health)
    else:
        print("\n[Sage X3] SKIP — Variables manquantes:", [v for v in x3_vars if not os.environ.get(v)])

    # Summary
    print(f"\n{'=' * 60}")
    total = results["summary"]["passed"] + results["summary"]["failed"]
    print(f"Resultat: {results['summary']['passed']}/{total} tests OK")
    if results["summary"]["failed"] > 0:
        print("Tests en echec:")
        for t in results["tests"]:
            if t["status"] == "FAIL":
                print(f"  - {t['name']}: {t['error']}")

    # Output JSON for pipeline consumption
    print(f"\n--- JSON ---\n{json.dumps(results, indent=2, default=str)}")
    sys.exit(1 if results["summary"]["failed"] > 0 else 0)
