#!/bin/bash
set -euo pipefail

echo "=== AutomIT — Policy Compliance Tests ==="
echo "Tests against control plane policy engine"
echo ""

CP_URL="${CONTROL_PLANE_URL:-http://127.0.0.1:3001}"
HMAC_SECRET="${AUTOMIT_HMAC_SECRET:-test-secret}"
PASS=0
FAIL=0
TOTAL=0

hmac_post() {
    local url=$1 payload=$2
    local sig
    sig=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex 2>/dev/null | awk '{print $NF}')
    curl -sf -X POST "$url" \
        -H "Content-Type: application/json" \
        -H "X-AutomIT-Signature: $sig" \
        -d "$payload" 2>/dev/null
}

test_policy() {
    local name=$1 payload=$2 expect_allowed=$3 expect_reason=${4:-""}
    TOTAL=$((TOTAL + 1))

    local result
    result=$(hmac_post "$CP_URL/execute" "$payload" 2>/dev/null || echo '{"error":"request_failed"}')

    local got_error
    got_error=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "parse_error")

    if [ "$expect_allowed" = "true" ]; then
        if [ -z "$got_error" ] || [ "$got_error" = "" ]; then
            echo "  [PASS] $name"
            PASS=$((PASS + 1))
        else
            echo "  [FAIL] $name — expected allowed, got error: $got_error"
            FAIL=$((FAIL + 1))
        fi
    else
        if [ -n "$got_error" ] && [ "$got_error" != "" ] && [ "$got_error" != "parse_error" ]; then
            if [ -n "$expect_reason" ]; then
                if echo "$got_error" | grep -qi "$expect_reason"; then
                    echo "  [PASS] $name — correctly blocked: $got_error"
                    PASS=$((PASS + 1))
                else
                    echo "  [FAIL] $name — blocked but wrong reason: $got_error (expected: $expect_reason)"
                    FAIL=$((FAIL + 1))
                fi
            else
                echo "  [PASS] $name — correctly blocked"
                PASS=$((PASS + 1))
            fi
        else
            echo "  [FAIL] $name — expected blocked, but request succeeded"
            FAIL=$((FAIL + 1))
        fi
    fi
}

TS=$(date +%s)

echo "[1/4] Tier enforcement"
test_policy "T2 blocked (Phase 5 gate)" \
    "{\"action\":{\"action_id\":\"restart_job\",\"tier\":2,\"target\":{\"type\":\"erp_job\",\"id\":\"IMPORT_COMMANDES\",\"display_name\":\"IMPORT_COMMANDES\"},\"requestor\":{\"glpi_user_id\":1,\"profile\":\"Super-Admin\",\"entity\":\"Root\",\"interface\":\"central\",\"right\":\"plugin_automit_critical\"},\"idempotency_key\":\"$(uuidgen 2>/dev/null || echo test-uuid)\",\"ttl_seconds\":300,\"issued_at\":$TS,\"justification\":\"test\"},\"timestamp\":$TS}" \
    "false" "Tier"

echo ""
echo "[2/4] Interface enforcement"
test_policy "Helpdesk interface blocked" \
    "{\"action\":{\"action_id\":\"get_ticket\",\"tier\":0,\"target\":{\"type\":\"glpi_ticket\",\"id\":\"1\",\"display_name\":\"Test\"},\"requestor\":{\"glpi_user_id\":1,\"profile\":\"Self-Service\",\"entity\":\"Root\",\"interface\":\"helpdesk\"},\"idempotency_key\":\"$(uuidgen 2>/dev/null || echo test-uuid-2)\",\"ttl_seconds\":300,\"issued_at\":$TS,\"justification\":\"test\"},\"timestamp\":$TS}" \
    "false" "Central"

echo ""
echo "[3/4] Target ID enforcement"
test_policy "Empty target blocked" \
    "{\"action\":{\"action_id\":\"get_ticket\",\"tier\":0,\"target\":{\"type\":\"glpi_ticket\",\"id\":\"\",\"display_name\":\"Test\"},\"requestor\":{\"glpi_user_id\":1,\"profile\":\"Super-Admin\",\"entity\":\"Root\",\"interface\":\"central\"},\"idempotency_key\":\"$(uuidgen 2>/dev/null || echo test-uuid-3)\",\"ttl_seconds\":300,\"issued_at\":$TS,\"justification\":\"test\"},\"timestamp\":$TS}" \
    "false" "target"

echo ""
echo "[4/4] Emergency stop"
ADMIN_TOKEN="${AUTOMIT_ADMIN_TOKEN:-test-token}"
# Activate e-stop
curl -sf -X POST "$CP_URL/kill" -H "Content-Type: application/json" -H "X-AutomIT-Admin-Token: $ADMIN_TOKEN" -d '{"stop":true}' > /dev/null 2>&1

test_policy "E-stop blocks Tier 1" \
    "{\"action\":{\"action_id\":\"add_followup\",\"tier\":1,\"target\":{\"type\":\"glpi_ticket\",\"id\":\"1\",\"display_name\":\"Test\"},\"requestor\":{\"glpi_user_id\":1,\"profile\":\"Super-Admin\",\"entity\":\"Root\",\"interface\":\"central\",\"right\":\"plugin_automit_execute\"},\"idempotency_key\":\"$(uuidgen 2>/dev/null || echo test-uuid-4)\",\"ttl_seconds\":300,\"issued_at\":$TS,\"justification\":\"test\"},\"timestamp\":$TS}" \
    "false" "Emergency"

# Deactivate e-stop
curl -sf -X POST "$CP_URL/kill" -H "Content-Type: application/json" -H "X-AutomIT-Admin-Token: $ADMIN_TOKEN" -d '{"stop":false}' > /dev/null 2>&1

echo ""
echo "=== Results: $PASS passed, $FAIL failed, $TOTAL total ==="
[ $FAIL -eq 0 ] && exit 0 || exit 1
