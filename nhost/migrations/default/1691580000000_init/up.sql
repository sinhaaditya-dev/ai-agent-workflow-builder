CREATE TABLE organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  calls_used integer DEFAULT 0 NOT NULL,
  calls_allowed integer DEFAULT 100 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE org_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL, -- references auth.users in nhost
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (user_id, org_id)
);

CREATE TABLE workflows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE workflow_steps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  type text NOT NULL CHECK (type IN ('llm_call', 'http_request', 'db_write', 'notify', 'conditional_branch', 'approval_gate')),
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (workflow_id, order_index)
);

CREATE TABLE workflow_triggers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('manual', 'webhook', 'scheduled', 'database_event')),
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE workflow_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone
);

CREATE TABLE step_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed')),
  input jsonb,
  output jsonb,
  error text,
  attempt_count integer DEFAULT 0 NOT NULL,
  approved_by uuid,
  approved_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Aggregation View for Organization Usage Stats
CREATE VIEW org_usage_stats AS
SELECT 
  org_id,
  COUNT(workflow_runs.id) as total_runs,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_runs,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_runs
FROM workflow_runs
JOIN workflows ON workflow_runs.workflow_id = workflows.id
GROUP BY workflows.org_id;
