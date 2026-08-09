'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { useUserData } from '@nhost/react';

const GET_USER_ORG = gql`
  query GetUserOrg($userId: uuid!) {
    org_members(where: { user_id: { _eq: $userId } }) {
      org_id
      role
    }
  }
`;

const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($name: String!, $orgId: uuid!) {
    insert_workflows_one(object: { name: $name, org_id: $orgId }) {
      id
    }
  }
`;

export default function NewWorkflow() {
  const [name, setName] = useState('');
  const router = useRouter();
  const user = useUserData();
  
  const { data, loading } = useQuery(GET_USER_ORG, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  const [createWorkflow, { loading: isCreating }] = useMutation(CREATE_WORKFLOW);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qData = data as any;
    if (!qData?.org_members?.[0]?.org_id) return;
    
    try {
      const result = await createWorkflow({
        variables: { name, orgId: qData.org_members[0].org_id }
      });
      const resData = result.data as any;
      if (resData?.insert_workflows_one?.id) {
        router.push(`/workflows/${resData.insert_workflows_one.id}`);
      }
    } catch (error) {
      console.error(error);
      alert("Error creating workflow.");
    }
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 p-8 flex justify-center items-center">
      <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6">Create Workflow</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Workflow Name</label>
            <input 
              required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead Enrichment"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button" 
              onClick={() => router.push('/')}
              className="px-4 py-2 text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isCreating}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md font-medium text-white disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
