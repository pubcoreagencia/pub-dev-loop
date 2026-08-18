async function pollTask(taskId) {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`http://localhost:3001/tasks/${taskId}`);
    const task = await res.json();
    console.log(`[${new Date().toISOString()}] Poll ${i+1}: Status=${task.status}`);
    if (task.status === 'COMPLETED' || task.status === 'FAILED') {
      console.log('\nFinal Task State:');
      console.log(JSON.stringify(task, null, 2));
      return task;
    }
    await new Promise(r => setTimeout(r, 4000));
  }
}

pollTask('d09dfa42-c81f-4d05-b327-47f977847d2d').catch(console.error);
