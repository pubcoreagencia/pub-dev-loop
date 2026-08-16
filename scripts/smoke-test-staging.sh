#!/bin/bash
# TASK-000032: Staging Smoke Test Script
# Validates the complete production execution path in staging.
#
# Prerequisites:
#   - docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build
#   - .env.staging configured with real 9Router API key
#   - 9Router running with active credentials for the target provider

set -e

API_URL="${API_URL:-http://localhost:3000}"
TEST_REPO="${TEST_REPO:-https://github.com/pubcoreagencia/pub-dev-loop.git}"

echo "=== STAGING SMOKE TEST ==="
echo ""

echo "1. Health checks..."
echo "  API /health:"
curl -sf "$API_URL/health" | jq -e '.status' || { echo "  ❌ API health failed"; exit 1; }
echo ""

echo "2. Submit smoke task..."
TASK_ID=$(curl -sf -X POST "$API_URL/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"project\": \"smoke-test\",
    \"repository\": \"$TEST_REPO\",
    \"objective\": \"smoke test for staging\",
    \"prompt\": \"Create a file named smoke-staging.txt with the content: staging-ok. Do not modify any other files.\"
  }" | jq -r '.id')

echo "  Task ID: $TASK_ID"

echo "3. Wait for completion (max 180s)..."
for i in $(seq 1 36); do
  RESPONSE=$(curl -sf "$API_URL/tasks/$TASK_ID" 2>/dev/null || echo '{"status":"ERROR"}')
  STATUS=$(echo "$RESPONSE" | jq -r '.status')
  echo "  [$i] Status: $STATUS"

  if [ "$STATUS" = "COMPLETED" ]; then
    COMMIT_SHA=$(echo "$RESPONSE" | jq -r '.commitSha')
    TRACE=$(echo "$RESPONSE" | jq '.result.trace')
    echo "  ✅ SMOKE TEST PASSED"
    echo "  Commit SHA: $COMMIT_SHA"
    echo "  Trace:"
    echo "$TRACE" | jq '.'
    exit 0
  fi

  if [ "$STATUS" = "FAILED" ]; then
    echo "  ❌ SMOKE TEST FAILED"
    echo "$RESPONSE" | jq '.result'
    exit 1
  fi

  sleep 5
done

echo "  ❌ SMOKE TEST TIMEOUT"
exit 1
