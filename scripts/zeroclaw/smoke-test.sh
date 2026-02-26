#!/bin/bash
# ZeroClaw post-upgrade smoke test
# Run after upgrading the ZeroClaw binary version
# Usage: docker exec automit-zeroclaw-erp-agent-1 /opt/scripts/zeroclaw/smoke-test.sh

set -e

echo "=== ZeroClaw Smoke Test ==="

# 1. Version check
echo -n "Version: "
zeroclaw --version || { echo "FAIL: zeroclaw --version"; exit 1; }

# 2. Config validation
echo -n "Config: "
zeroclaw config validate 2>/dev/null && echo "OK" || { echo "FAIL: config validate"; exit 1; }

# 3. Auth status
echo -n "Auth: "
zeroclaw auth status 2>/dev/null && echo "OK" || echo "WARN: auth not configured (expected in fresh deploy)"

# 4. Status check
echo -n "Status: "
zeroclaw status 2>/dev/null && echo "OK" || { echo "FAIL: zeroclaw status"; exit 1; }

echo "=== Smoke Test PASSED ==="
