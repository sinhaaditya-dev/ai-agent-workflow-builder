'use client';

import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useParams, useRouter } from 'next/navigation';
import { useState, use } from 'react';
import { useUserData, useNhostClient } from '@nhost/react';
import { Play, Plus, Server, Settings2, Webhook, Database, Cpu, CheckCircle } from 'lucide-react';

const GET_WORKFLOW = gql`
  query GetWorkflow($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      name
      org_id
      organization {
        org_members {
          role
          user_id
        }
      }
      steps(order_by: { order_index: asc }) {
        id
        type
        config
        order_index
      }
      triggers {
        id
        type
        config
      }
    }
  }
`;

const ADD_STEP = gql`
  mutation AddStep($workflowId: uuid!, $type: String!, $orderIndex: Int!, $config: jsonb!) {
    insert_workflow_steps_one(object: {
      workflow_id: $workflowId, type: $type, order_index: $orderIndex, config: $config
    }) { id }
  }
`;



const RUN_SUBSCRIPTION = gql`
  subscription GetRuns($workflowId: uuid!) {
    workflow_runs(where: { workflow_id: { _eq: $workflowId } }, order_by: { created_at: desc }, limit: 1) {
      id
      status
      step_runs(order_by: { started_at: asc }) {
        id
        step_id
        status
        output
        error
      }
    }
  }
`;

export default function WorkflowBuilder() {
  const { id } = useParams() as { id: string };
  const user = useUserData();
  const nhost = useNhostClient();
  const router = useRouter();

  const { data, loading: wfLoading, refetch } = useQuery(GET_WORKFLOW, {
    variables: { id }
  });
  const wfData = data as any;
  
  const { data: rawRunData } = useSubscription(RUN_SUBSCRIPTION, {
    variables: { id }
  });
  const runData = rawRunData as any;

  const [addStep] = useMutation(ADD_STEP);
  const [isRunning, setIsRunning] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  if (wfLoading) return <div className="p-8 text-white">Loading Workflow...</div>;
  if (!wfData?.workflows_by_pk) return <div className="p-8 text-white">Workflow not found.</div>;

  const workflow = wfData.workflows_by_pk;
  const member = workflow?.organization?.org_members?.find((m: any) => m.user_id === user?.id);
  const role = member?.role;
  const canEdit = role === 'owner' || role === 'editor';

  const handleAddStep = async (type: string) => {
    if (!canEdit) return;
    try {
      await addStep({
        variables: {
          workflowId: id,
          type,
          orderIndex: workflow?.steps?.length || 0,
          config: {}
        }
      });
      refetch();
    } catch (e: any) {
      alert("Error adding step: " + e.message);
    }
  };

  const handleRun = async () => {
    if (!canEdit) return;
    setIsRunning(true);
    try {
      const { res, error } = await nhost.functions.call('triggerWorkflowRun', {
        input: { workflow_id: id }
      });
      if (error) throw error;
    } catch (e: any) {
      alert("Error starting run: " + e.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleApprove = async (stepRunId: string) => {
    if (!canEdit) return;
    setIsApproving(true);
    try {
      const { res, error } = await nhost.functions.call('approveStep', {
        input: { step_run_id: stepRunId }
      });
      if (error) throw error;
    } catch (e: any) {
      alert("Error approving step: " + e.message);
    } finally {
      setIsApproving(false);
    }
  };

  const activeRun = runData?.workflow_runs?.[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-zinc-400 hover:text-white">← Back</button>
          <h1 className="text-xl font-bold">{workflow.name}</h1>
        </div>
        <div className="flex gap-3">
          {canEdit && (
            <button 
              onClick={handleRun}
              disabled={isRunning || activeRun?.status === 'running'}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-md font-medium flex items-center gap-2 text-sm"
            >
              <Play size={16} /> {isRunning ? 'Starting...' : 'Run Workflow'}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas / Steps List */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            {workflow?.steps?.map((step: any, idx: number) => {
              // Find matching step_run if there is an active run
              const stepRun = activeRun?.step_runs?.find((sr: any) => sr.step_id === step.id);
              
              return (
                <div key={step.id} className="relative mb-8">
                  {idx > 0 && <div className="absolute top-[-32px] left-8 w-0.5 h-8 bg-zinc-700"></div>}
                  <div className={`p-4 rounded-xl border ${
                    stepRun?.status === 'running' ? 'border-blue-500 bg-blue-500/10' :
                    stepRun?.status === 'completed' ? 'border-green-500 bg-green-500/10' :
                    stepRun?.status === 'failed' ? 'border-red-500 bg-red-500/10' :
                    stepRun?.status === 'paused' ? 'border-yellow-500 bg-yellow-500/10' :
                    'border-zinc-700 bg-zinc-900'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="bg-zinc-800 p-2 rounded-lg text-zinc-300">
                          {step.type === 'llm_call' ? <Cpu size={20} /> :
                           step.type === 'http_request' ? <Webhook size={20} /> :
                           step.type === 'db_write' ? <Database size={20} /> :
                           <Settings2 size={20} />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{step.type}</h3>
                          <div className="text-xs text-zinc-400">Step {idx + 1}</div>
                        </div>
                      </div>
                      
                      {stepRun && (
                        <div className="text-sm">
                          <span className={`px-2 py-1 rounded-full ${
                            stepRun.status === 'completed' ? 'text-green-400' :
                            stepRun.status === 'paused' ? 'text-yellow-400 animate-pulse' :
                            'text-zinc-400'
                          }`}>
                            {stepRun.status}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {stepRun?.status === 'paused' && canEdit && (
                      <div className="mt-4 p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/30 flex justify-between items-center">
                        <div className="text-sm text-yellow-200">Requires Approval to proceed</div>
                        <button 
                          onClick={() => handleApprove(stepRun.id)}
                          disabled={isApproving}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm flex items-center gap-2"
                        >
                          <CheckCircle size={16} /> Approve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {canEdit && (
              <div className="mt-8 pt-8 border-t border-zinc-800 border-dashed">
                <h3 className="text-sm text-zinc-400 mb-4 font-medium uppercase tracking-wider">Add Step</h3>
                <div className="flex flex-wrap gap-2">
                  {['llm_call', 'http_request', 'db_write', 'conditional_branch', 'approval_gate'].map((type) => (
                    <button 
                      key={type}
                      onClick={() => handleAddStep(type)}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                    >
                      <Plus size={14} /> {type}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Active Run details */}
        <div className="w-80 border-l border-zinc-800 bg-zinc-900 flex flex-col hidden lg:flex">
          <div className="p-4 border-b border-zinc-800 font-semibold text-zinc-300 uppercase text-sm tracking-wider">
            Execution Log
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {!activeRun ? (
              <div className="text-zinc-500 text-sm">No recent executions.</div>
            ) : (
              <div>
                <div className="mb-4">
                  <span className="text-xs text-zinc-400">Run ID: </span>
                  <span className="text-xs font-mono">{activeRun.id.substring(0,8)}</span>
                  <div className={`mt-1 text-sm ${
                    activeRun.status === 'completed' ? 'text-green-400' : 'text-blue-400'
                  }`}>Status: {activeRun.status}</div>
                </div>
                
                {activeRun.step_runs.map((sr: any, i: number) => (
                  <div key={sr.id} className="border-l-2 border-zinc-700 pl-3 py-1 mb-3">
                    <div className="text-xs text-zinc-400">Step {i+1}</div>
                    <div className="text-sm">{sr.status}</div>
                    {sr.error && <div className="text-xs text-red-400 mt-1">{sr.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
