# AI Agent Workflow Builder

A mini n8n built with Next.js, Nhost, Hasura, PostgreSQL, and GraphQL. 
Purpose-built for chaining AI agent steps with strict organization-level isolation and role-based access control.

## Overview

This project implements a workflow execution engine where organizations can define multi-step AI workflows (`llm_call`, `http_request`, `conditional_branch`, etc.) and run them manually or via events.

### Tech Stack
- **Frontend:** Next.js (App Router), Tailwind CSS, `@nhost/react`, `@apollo/client`
- **Backend:** Nhost (Managed Hasura GraphQL, PostgreSQL, Auth, Serverless Functions)

## Setup Instructions

### 1. Nhost Cloud Setup
Since Nhost local development requires Docker, the easiest way to run this is via a free Nhost Cloud project.

1. Go to [nhost.io](https://nhost.io) and create a free project.
2. Link your GitHub repository to your Nhost project. Nhost will automatically apply the database migrations in `nhost/migrations` and metadata in `nhost/metadata`.
3. In your Nhost Project Settings, add the following Environment Variables for the Serverless Functions:
   - `GEMINI_API_KEY`: Your Gemini API key for `llm_call` steps.

### 2. Next.js Frontend Setup
Create a `.env.local` file in the root directory and add your Nhost credentials:
```env
NEXT_PUBLIC_NHOST_SUBDOMAIN=your-subdomain
NEXT_PUBLIC_NHOST_REGION=your-region
```

Install dependencies and run the development server:
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Architecture

- **Hasura (Layer 1 Permissions):** Handles all standard CRUD operations. Row-level security ensures users can only see and modify data in their own organizations based on the `org_members` table.
- **Serverless Functions (Layer 2 Permissions):** The `triggerWorkflowRun` and `approveStep` functions act as Hasura Actions. They validate quotas and check that the user holds the appropriate role (e.g., owner/editor) *mid-execution* before proceeding.

See `design_writeup.md` for a complete architectural teardown.
