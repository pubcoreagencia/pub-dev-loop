#!/usr/bin/env python
"""TASK-000033: Staging Smoke Test — validates full production execution path."""
import json, time, urllib.request, sys

API_URL = "http://localhost:3001"
TEST_REPO = "https://github.com/octocat/Hello-World.git"

def post(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode(),
                                 headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def get(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode())

print("=== STAGING SMOKE TEST (TASK-000033) ===\n")

# 1. Health check
print("1. Health checks...")
try:
    health = get(f"{API_URL}/health")
    print(f"  API /health: {health} ✅")
except Exception as e:
    print(f"  ❌ API health failed: {e}")
    sys.exit(1)

# 2. Submit task
print("\n2. Submit smoke task...")
task = post(f"{API_URL}/tasks", {
    "project": "smoke-test-final",
    "repository": TEST_REPO,
    "objective": "final staging smoke test TASK-000033",
    "prompt": "Create a file named smoke-final.txt with the content: final-ok. Do not modify any other files.",
    "priority": 1
})
TASK_ID = task['id']
print(f"  Task ID: {TASK_ID}")
print(f"  Status: {task['status']}")

# 3. Wait for completion
print(f"\n3. Wait for completion (max 180s)...")
for i in range(36):
    time.sleep(5)
    try:
        task = get(f"{API_URL}/tasks/{TASK_ID}")
        status = task.get('status')
        print(f"  [{i*5+5}s] Status: {status}")
        
        if status in ('COMPLETED', 'FAILED'):
            result = task.get('result', {})
            trace = result.get('trace', {})
            finalize = result.get('finalize', {})
            
            print(f"\n=== FINAL RESULT ===")
            print(f"  Status: {status}")
            print(f"  Commit SHA: {task.get('commitSha', 'N/A')}")
            print(f"  Attempts: {len(trace.get('attempts', []))}")
            print(f"  Winning attempt: {trace.get('winningAttempt')}")
            print(f"  Finalize status: {trace.get('finalizeStatus')}")
            print(f"  Finalize called: {trace.get('finalizeWasCalled')}")
            print(f"  Final status: {trace.get('finalStatus')}")
            
            if status == 'COMPLETED':
                print(f"\n  ✅ SMOKE TEST PASSED")
                print(f"\n  Full trace:")
                print(json.dumps(trace, indent=2, default=str))
                print(f"\n  Full task:")
                print(json.dumps(task, indent=2, default=str)[:3000])
                sys.exit(0)
            else:
                print(f"\n  ❌ SMOKE TEST FAILED")
                print(json.dumps(task, indent=2, default=str)[:3000])
                sys.exit(1)
    except Exception as e:
        print(f"  [{i*5+5}s] Error: {e}")

print(f"\n  ❌ SMOKE TEST TIMEOUT")
sys.exit(1)