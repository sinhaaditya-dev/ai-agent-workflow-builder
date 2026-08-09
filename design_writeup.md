# Design Write-Up: AI Agent Workflow Builder

## 1. Schema Reasoning & Relationships

The data model is designed to support multi-tenant isolation, structured workflows, and real-time execution tracking.

- **Organizations & Members:** Multi-tenancy is handled via the `organizations` and `org_members` tables. An organization acts as the boundary for all data. Quotas (`calls_used`, `calls_allowed`) are stored directly on the organization, while `org_members` maps a `user_id` (from Nhost Auth) to an `org_id` with a specific role (`owner`, `editor`, `viewer`).
- **Workflows & Steps:** A `workflow` belongs to an organization. It has a one-to-many relationship with `workflow_steps` (ordered nodes) and `workflow_triggers` (entry points). Storing step configurations as `jsonb` allows for flexibility across vastly different step types (HTTP configs, LLM prompts) without schema sprawl.
- **Runs & Step Runs:** Executions are tracked in `workflow_runs`. Each run spins off `step_runs`, which log inputs, outputs, attempt counts, and the execution status (`pending`, `running`, `paused`, `completed`, `failed`). This separation ensures that the frontend can subscribe specifically to `step_runs` to render a live, granular view of the execution.

## 2. The Two-Layer Permission Model

A central challenge of building an extensible workflow engine is ensuring that generic database rules do not compromise business logic during execution. This requires two distinct permission layers:

### Layer 1: Row-Level Security (Hasura)
Hasura enforces permissions at the edge of the API. Every GraphQL query is scoped to the `x-hasura-user-id`. 
- **Isolation:** By traversing relationships (e.g., `workflows.organization.org_members.user_id`), Hasura ensures that users can *never* query or mutate data for organizations they do not belong to. Direct ID guessing is mitigated because the database engine applies a `WHERE org_members.user_id = $caller` clause to every operation.
- **Roles:** The role (viewer, editor, owner) dictates the operation types (SELECT vs INSERT/UPDATE). Viewers are explicitly denied mutation access.

### Layer 2: Mid-Execution Gating (Serverless Functions)
Row-level security protects the *data*, but it cannot protect the *system*. When a user attempts to add a `db_write` step or trigger a run, this requires business logic validation.
- We use Nhost Serverless Functions as Hasura Action Handlers (`triggerWorkflowRun` and `approveStep`). 
- When `triggerWorkflowRun` is called, the function securely queries the database to verify the organization's quota and checks that the caller has `editor` or `owner` privileges *before* making external LLM or HTTP calls. 
- This layer guarantees that malicious actors cannot bypass quota limits or execute dangerous external mutations, even if they somehow manipulate a generic GraphQL mutation.

## 3. The Approval Gate Pause/Resume Implementation

The `approval_gate` step is handled asynchronously by separating the execution engine state from the HTTP request cycle:

1. **Pause:** When the workflow execution loop (`triggerWorkflowRun`) encounters an `approval_gate` step, it immediately sets the `step_run` status to `paused` and **terminates its execution thread**. It does not block or poll. The `workflow_run` is left in a `running` or `paused` state.
2. **Subscription Update:** Because the `step_run` status is written to Postgres, Hasura immediately broadcasts this update via GraphQL Subscriptions to the Next.js frontend, rendering the "Approve" button.
3. **Resume (Gated):** The "Approve" button triggers a separate Hasura Action (`approveStep`). This function receives the `step_run_id` and the caller's `user_id`. 
4. **Validation:** `approveStep` performs a critical Layer 2 check: it verifies that the `user_id` corresponds to an `owner` or `editor` in the workflow's parent organization. 
5. **Continuation:** If validated, it records the `approved_by` and `approved_at` fields, sets the step to `completed`, and re-invokes the execution engine to continue running the subsequent steps in the workflow.
