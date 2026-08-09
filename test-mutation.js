const { NhostClient } = require('@nhost/nhost-js');

const nhost = new NhostClient({
  subdomain: 'vxqkwpkzbxtguinmkjqc',
  region: 'ap-south-1'
});

async function run() {
  console.log('Sending request to Nhost function...');
  try {
    const response = await fetch('https://vxqkwpkzbxtguinmkjqc.functions.ap-south-1.nhost.run/v1/triggerWorkflowRun', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          mutation TriggerRun($workflowId: uuid!) {
            triggerWorkflowRun(input: { workflow_id: $workflowId }) {
              workflow_run_id
              status
            }
          }
        `,
        variables: {
          workflowId: '00000000-0000-0000-0000-000000000000'
        }
      })
    });
    const json = await response.json();
    console.log('Response:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('Fetch failed:', e);
  }
}

run();
