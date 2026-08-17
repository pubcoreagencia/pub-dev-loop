#!/bin/bash
# TASK-000032: Staging Smoke Test Script
# Validates the complete production execution path in staging.
#
# Prerequisites:
#   - docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build
#   - .env.staging configured with 9Router access
#   - 9Router running on localhost:20128

set -e

API_URL="${API_URL:-http://localhost:3001}"
TEST_REPO="${TEST_REPO:-https://github.com/octocat/Hello-World.git}"

echo "=== STAGING SMOKE TEST ==="
echo ""

echo "1. Health checks..."
echo -n "  API /health: "
curl -sf "$API_URL/health" && echo " ✅" || { echo "❌"; exit 1; }
echo ""

echo "2. Submit smoke task..."
TASK_ID=$(curl -sf -X POST "$API_URL/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"project\": \"smoke-test\",
    \"repository\": \"$TEST_REPO\",
    \"objective\": \"staging smoke test\",
    \"prompt\": \"Create a file named smoke-staging.txt with the content: staging-ok. Do not modify any other files.\"
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "  Task ID: $TASK_ID"

echo "3. Wait for completion (max 180s)..."
for i in $(seq 1 36); do
  RESPONSE=$(curl -sf "$API_URL/tasks/$TASK_ID" 2>/dev/null || echo '{"status":"ERROR"}')
  STATUS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['status'])" 2>/dev/null || echo "ERROR")
  echo "  [$i] Status: $STATUS"

  if [ "$STATUS" = "COMPLETED" ]; then
    COMMIT_SHA=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('commitSha',''))" 2>/dev/null || echo "")
    echo "  ✅ SMOKE TEST PASSED"
    echo "  Commit SHA: $COMMIT_SHA"
    echo "  Full result:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -30
    exit 0
  fi

  if [ "$STATUS" = "FAILED" ]; then
    echo "  ❌ SMOKE TEST FAILED"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -30
    exit 1
  fi

  sleep 5
done

echo "  ❌ SMOKE TEST TIMEOUT"
exit 1