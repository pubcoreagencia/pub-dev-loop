async function submitTask() {
  const payload = {
    project: 'pub-dev-loop',
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
    objective: 'Create a minimal verified file and validate the repository',
    prompt: 'Please create a verified status file named 9ROUTER_STATUS.md containing "9Router officially verified and operational for PUB DEV LOOP.". Do not alter other files.',
    priority: 1
  };
  const res = await fetch('http://localhost:3001/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log('API POST /tasks status:', res.status);
  const task = await res.json();
  console.log('Created Task ID:', task.id);
  console.log('Initial Status:', task.status);
}

submitTask().catch(console.error);
