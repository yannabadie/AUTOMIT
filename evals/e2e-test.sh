#!/bin/bash
set -euo pipefail

echo "=== AutomIT v2 — End-to-End Integration Test ==="
PASS=0
FAIL=0

check() {
    local name=$1 cmd=$2
    if eval "$cmd" > /dev/null 2>&1; then
        echo "  [PASS] $name"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $name"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "[1/4] Health checks"
check "Kestra" "curl -sf http://127.0.0.1:8080/api/v1/health"
check "Control Plane" "curl -sf http://127.0.0.1:3001/health"
check "Tool Gateway" "curl -sf http://127.0.0.1:3002/health"

echo ""
echo "[2/4] Tool Gateway endpoints"
HMAC_SECRET="${AUTOMIT_HMAC_SECRET:-test-secret}"

hmac_curl() {
    local method=$1 url=$2 data=${3:-""}
    local sig
    sig=$(echo -n "$data" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex 2>/dev/null | awk '{print $NF}')
    if [ "$method" = "GET" ]; then
        curl -sf "$url" -H "X-Signature: $sig"
    else
        curl -sf -X "$method" "$url" -H "Content-Type: application/json" -H "X-Signature: $sig" -d "$data"
    fi
}

check "ERP job list" "hmac_curl GET http://127.0.0.1:3002/erp/jobs"
check "ERP job status" "hmac_curl GET http://127.0.0.1:3002/erp/job/IMPORT_COMMANDES/status"

echo ""
echo "[3/4] Control Plane (HMAC-signed requests)"
PAYLOAD="{\"ticket_id\":1,\"mode\":\"analyze\",\"user_id\":1,\"profile\":\"Super-Admin\",\"entity\":\"Root\",\"interface\":\"central\",\"timestamp\":$(date +%s)}"
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex 2>/dev/null | awk '{print $NF}')
check "Analyze endpoint" "curl -sf -X POST http://127.0.0.1:3001/analyze -H 'Content-Type: application/json' -H 'X-AutomIT-Signature: $SIG' -d '$PAYLOAD'"

echo ""
echo "[4/4] Emergency stop"
ADMIN_TOKEN="${AUTOMIT_ADMIN_TOKEN:-test-token}"
check "Kill switch" "curl -sf -X POST http://127.0.0.1:3001/kill -H 'Content-Type: application/json' -H 'X-AutomIT-Admin-Token: $ADMIN_TOKEN' -d '{\"stop\":true}'"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ $FAIL -eq 0 ] && exit 0 || exit 1
