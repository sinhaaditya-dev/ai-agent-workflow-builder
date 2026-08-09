'use client';

import { useSignUpEmailPassword, useUserData } from '@nhost/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, gql } from '@apollo/client/react';

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

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  
  const { signUpEmailPassword, isLoading, isError, error } = useSignUpEmailPassword();
  const [createOrg, { loading: isCreatingOrg }] = useMutation(CREATE_ORG);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await signUpEmailPassword(email, password);
    
    if (result.isSuccess && result.user?.id) {
      // Create organization
      try {
        await createOrg({
          variables: { orgName, userId: result.user.id }
        });
        router.push('/');
      } catch (err) {
        console.error('Failed to create organization', err);
        // We still push to home, but they will see "not a member of any organization"
        router.push('/');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
            Create an account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address" name="email" type="email" required
                className="relative block w-full appearance-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-400 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password" name="password" type="password" required
                className="relative block w-full appearance-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-400 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="org-name" className="sr-only">Organization Name</label>
              <input
                id="org-name" name="orgName" type="text" required
                className="relative block w-full appearance-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-400 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
          </div>

          {isError && (
            <div className="text-red-500 text-sm text-center">
              {error?.message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || isCreatingOrg}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50"
            >
              {isLoading || isCreatingOrg ? 'Creating account...' : 'Sign up'}
            </button>
          </div>
          
          <div className="text-center text-sm text-zinc-400">
            Already have an account? <a href="/login" className="text-indigo-400 hover:text-indigo-300">Sign in</a>
          </div>
        </form>
      </div>
    </div>
  );
}
