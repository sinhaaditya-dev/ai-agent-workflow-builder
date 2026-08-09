const { NhostClient } = require('@nhost/nhost-js');

const nhost = new NhostClient({
  subdomain: 'vxqkwpkzbxtguinmkjqc',
  region: 'ap-south-1'
});

async function run() {
  // Sign up a dummy user
  const email = `test-${Date.now()}@example.com`;
  console.log(`Signing up ${email}...`);
  const { session, error: signUpError } = await nhost.auth.signUp({
    email,
    password: 'password123'
  });

  if (signUpError) {
    console.error('Sign up error:', signUpError);
    return;
  }

  const token = session?.accessToken;
  if (!token) {
    console.error('No access token received.');
    return;
  }

  console.log('Querying GraphQL endpoint for schema introspection...');
  const response = await fetch(nhost.graphql.httpUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `
        query {
          __schema {
            mutationType {
              name
              fields {
                name
              }
            }
          }
        }
      `
    })
  });

  const json = await response.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
  } else if (!json.data.__schema.mutationType) {
    console.error('No mutation type found! The user role has no insert/update/delete permissions.');
  } else {
    console.log('Available mutations:');
    json.data.__schema.mutationType.fields.forEach(f => console.log(' - ' + f.name));
  }
}

run();
