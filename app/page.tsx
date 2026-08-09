'use client';

import { useAuthenticationStatus, useUserData, useSignOut } from '@nhost/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import Link from 'next/link';

const CREATE_ORG = gql`
  mutation CreateOrg($orgName: String!, $userId: uuid!) {
    insert_organizations_one(object: {
      name: $orgName,
      org_members: {
        data: {
          user_id: $userId,
          role: "owner"
        }
      }
    }) {
      id
    }
  }
`;

const GET_ORG_DATA = gql`
  query GetOrgData($userId: uuid!) {
    org_members(where: { user_id: { _eq: $userId } }) {
      role
      organization {
        id
        name
        calls_used
        calls_allowed
        workflows {
          id
          name
          created_at
          runs(order_by: { created_at: desc }, limit: 1) {
            status
            created_at
          }
        }
      }
    }
  }
`;

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const user = useUserData();
  const { signOut } = useSignOut();
  const router = useRouter();

  const { data, loading: queryLoading, error } = useQuery(GET_ORG_DATA, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  const [createOrg, { loading: isCreatingOrg }] = useMutation(CREATE_ORG);
  const [newOrgName, setNewOrgName] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || queryLoading || !isAuthenticated) {
    return <div className="p-8 text-white">Loading...</div>;
  }

  const member = data?.org_members?.[0];
  const org = member?.organization;

  if (!org) {
    const handleCreateOrg = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.id) return;
      try {
        await createOrg({
          variables: { orgName: newOrgName, userId: user.id },
          refetchQueries: [{ query: GET_ORG_DATA, variables: { userId: user.id } }]
        });
      } catch (err) {
        console.error(err);
        alert('Failed to create organization. Ensure permissions are applied.');
      }
    };

    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-white flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-4">Almost there!</h2>
        <p className="text-zinc-400 mb-8">You don't have a workspace yet. Let's create one.</p>
        
        <form onSubmit={handleCreateOrg} className="w-full max-w-md bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <input
            type="text"
            required
            placeholder="Organization Name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 mb-4 text-white"
          />
          <button
            type="submit"
            disabled={isCreatingOrg}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {isCreatingOrg ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
        <button onClick={() => signOut()} className="mt-8 text-zinc-500 hover:text-white">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">AI Workflow Builder</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-zinc-400">
            {org.name} | Role: <span className="text-white">{member.role}</span>
          </div>
          <button onClick={() => signOut()} className="text-sm bg-zinc-800 px-3 py-1 rounded hover:bg-zinc-700">Sign Out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h3 className="text-zinc-400 text-sm mb-2">Usage Quota</h3>
            <div className="text-3xl font-bold">
              {org.calls_used} <span className="text-xl text-zinc-500">/ {org.calls_allowed}</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 mt-4 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full"
                style={{ width: `${Math.min(100, (org.calls_used / org.calls_allowed) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Workflows</h2>
          {member.role !== 'viewer' && (
            <Link href="/workflows/new" className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md font-medium">
              Create Workflow
            </Link>
          )}
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          {org.workflows.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">No workflows found.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-sm">
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Last Run Status</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {org.workflows.map((wf: any) => (
                  <tr key={wf.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                    <td className="p-4 font-medium">{wf.name}</td>
                    <td className="p-4">
                      {wf.runs?.[0] ? (
                        <span className={`px-2 py-1 text-xs rounded-full ${wf.runs[0].status === 'completed' ? 'bg-green-500/10 text-green-400' :
                          wf.runs[0].status === 'failed' ? 'bg-red-500/10 text-red-400' :
                            wf.runs[0].status === 'paused' ? 'bg-yellow-500/10 text-yellow-400' :
                              'bg-blue-500/10 text-blue-400'
                          }`}>
                          {wf.runs[0].status}
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-sm">Never run</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Link href={`/workflows/${wf.id}`} className="text-indigo-400 hover:text-indigo-300 mr-4">
                        View / Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
