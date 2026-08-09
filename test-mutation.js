
async function run() {
  console.log('Sending request to Nhost function...');
  try {
    const response = await fetch('https://vxqkwpkzbxtguinmkjqc.nhost.run/v1/functions/triggerWorkflowRun', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: { workflow_id: '00000000-0000-0000-0000-000000000000' }
      })
    });
    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
  } catch (e) {
    console.error('Fetch failed:', e);
  }
}

run();
