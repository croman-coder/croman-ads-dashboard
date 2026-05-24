# Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-step approval layer that blocks risky Meta Ads mutations (budget changes, activations, campaign creation) until an authorized human reviews them, with full audit trail in Postgres.

**Architecture:** Intercept existing `/api/mutation/*` routes. When `requiresApproval(action) === true`, insert a `mutation_proposals` row and return `202 { status: 'pending' }` instead of calling Meta. Approval/reject routes execute or discard the queued mutation. UI shows pending queue at `/approvals` with diff viewer and sidebar badge count. 72h auto-expiration via Vercel cron.

**Tech Stack:** Next.js 16 App Router · Vercel Postgres (`@vercel/postgres`) · Zod validation · Vitest for tests · existing JWT auth + middleware.

---

## File Structure

### New files

```
src/lib/
├── approval-policy.ts          (risky-action classifier)
├── proposal-store.ts            (Postgres CRUD)
├── proposal-validators.ts       (Zod schemas per action)
├── proposal-executor.ts         (executes approved proposal against Meta)
├── use-approval-count.ts        (client hook for sidebar badge)
└── __mocks__/meta-api.ts        (test stub)

src/app/api/proposals/
├── route.ts                     (GET list)
├── [id]/route.ts                (GET detail)
├── [id]/approve/route.ts        (POST approve+execute)
├── [id]/reject/route.ts         (POST reject)
└── expire/route.ts              (POST cron)

src/app/approvals/
├── page.tsx                     (list with tabs)
└── [id]/page.tsx                (detail with diff)

src/components/
├── ApprovalCard.tsx
└── DiffViewer.tsx

scripts/db/
└── migrate.ts                   (idempotent schema)

vercel.json                      (cron config)
vitest.config.ts                 (test runner config)
src/__tests__/setup.ts           (test env bootstrap)
```

### Modified files

```
src/app/api/mutation/budget/route.ts      (interceptor)
src/app/api/mutation/status/route.ts       (interceptor for ACTIVE only)
src/app/api/campaign/create/route.ts       (interceptor)
src/components/Sidebar.tsx                 (add /approvals nav + badge)
src/app/budgets/page.tsx                   (handle pending toast)
src/app/campaigns/page.tsx                 (handle pending toast)
src/app/campaigns/new/page.tsx             (handle pending result)
package.json                               (deps: @vercel/postgres, zod, vitest)
.env.example                               (POSTGRES_URL + CRON_SECRET)
```

---

## Phase 0: Test Infrastructure + Dependencies

### Task 0.1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd /home/croman/Escritorio/croman-ads-dashboard
npm install @vercel/postgres@^0.10.0 zod@^3.23.0
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D vitest@^2 @vitest/coverage-v8@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 happy-dom@^15
```

- [ ] **Step 3: Verify installed**

Run: `npm ls @vercel/postgres zod vitest`
Expected: shows installed versions, no UNMET errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @vercel/postgres + zod + vitest"
```

---

### Task 0.2: Vitest config + setup

**Files:**
- Create: `vitest.config.ts`
- Create: `src/__tests__/setup.ts`
- Modify: `package.json` (add test scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**', 'src/app/api/**'],
      exclude: ['**/__mocks__/**', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 2: Create `src/__tests__/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

process.env.AUTH_EMAIL = 'test@example.com';
process.env.AUTH_SECRET = 'test_secret_dev_only_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.META_ACCESS_TOKEN = 'test_token';
process.env.META_API_VERSION = 'v21.0';
process.env.BUDGET_CAP_USD = '1000';

// stub fetch for Meta API calls
global.fetch = vi.fn();
```

- [ ] **Step 3: Add test scripts to `package.json`**

In `"scripts"` block:
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:cov": "vitest run --coverage"
}
```

- [ ] **Step 4: Run test command (should pass with no tests)**

Run: `npm test`
Expected: `No test files found` exit 0 (or empty pass).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/__tests__/setup.ts package.json
git commit -m "test: vitest infrastructure + happy-dom env"
```

---

## Phase 1: Database Schema

### Task 1.1: Schema migration script

**Files:**
- Create: `scripts/db/migrate.ts`
- Create: `scripts/db/schema.sql`
- Modify: `package.json` (add `db:migrate` script)
- Modify: `.env.example`

- [ ] **Step 1: Create `scripts/db/schema.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM (
    'pending', 'approved', 'rejected', 'executed', 'failed', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE proposal_action AS ENUM (
    'set_budget', 'activate', 'create_campaign', 'duplicate_campaign'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS mutation_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  proposed_by     TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  action          proposal_action NOT NULL,
  scope           TEXT NOT NULL,
  scope_id        TEXT,
  scope_name      TEXT,
  payload         JSONB NOT NULL,
  current_state   JSONB,
  reason          TEXT,
  status          proposal_status NOT NULL DEFAULT 'pending',
  decided_at      TIMESTAMPTZ,
  decided_by      TEXT,
  decision_note   TEXT,
  executed_at     TIMESTAMPTZ,
  meta_response   JSONB,
  error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_proposals_status_expires
  ON mutation_proposals(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_proposals_account
  ON mutation_proposals(account_id, created_at DESC);
```

- [ ] **Step 2: Create `scripts/db/migrate.ts`**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from '@vercel/postgres';

async function main() {
  const file = resolve(process.cwd(), 'scripts/db/schema.sql');
  const ddl = readFileSync(file, 'utf8');
  console.log('Running migration…');
  // @vercel/postgres `sql` is tagged template; use raw query for multi-statement
  await sql.query(ddl);
  console.log('✓ Migration applied');
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
```

- [ ] **Step 3: Add migrate script to `package.json`**

```json
{
  "db:migrate": "tsx scripts/db/migrate.ts"
}
```

- [ ] **Step 4: Install tsx as dev dep**

```bash
npm install -D tsx@^4
```

- [ ] **Step 5: Update `.env.example`**

Append:
```
# Postgres (Vercel Postgres add-on injects these automatically in prod)
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Cron secret (Vercel cron auth)
CRON_SECRET=
```

- [ ] **Step 6: Commit**

```bash
git add scripts/db/ package.json package-lock.json .env.example
git commit -m "feat(db): postgres schema + migration script"
```

**Note:** Actual migration run happens after Vercel Postgres is provisioned. Manual step:
```bash
vercel env pull .env.local
npm run db:migrate
```

---

Continuará en la siguiente parte del plan (Phase 2-6).

## Phase 2: Core libraries (TDD)

### Task 2.1: `approval-policy.ts`

**Files:**
- Create: `src/lib/approval-policy.ts`
- Test: `src/lib/__tests__/approval-policy.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/__tests__/approval-policy.test.ts
import { describe, it, expect } from 'vitest';
import { requiresApproval, RISKY_ACTIONS } from '../approval-policy';

describe('requiresApproval', () => {
  it('returns true for risky actions', () => {
    expect(requiresApproval('set_budget')).toBe(true);
    expect(requiresApproval('activate')).toBe(true);
    expect(requiresApproval('create_campaign')).toBe(true);
    expect(requiresApproval('duplicate_campaign')).toBe(true);
  });
  it('returns false for safe actions', () => {
    expect(requiresApproval('rename')).toBe(false);
    expect(requiresApproval('pause')).toBe(false);
    expect(requiresApproval('update_targeting')).toBe(false);
    expect(requiresApproval('swap_form')).toBe(false);
  });
  it('returns false for unknown actions', () => {
    expect(requiresApproval('foo_bar')).toBe(false);
  });
  it('exports complete RISKY_ACTIONS set', () => {
    expect(RISKY_ACTIONS.size).toBe(4);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test approval-policy`
Expected: FAIL `Cannot find module '../approval-policy'`

- [ ] **Step 3: Implement**

```ts
// src/lib/approval-policy.ts
export const RISKY_ACTIONS: ReadonlySet<string> = new Set([
  'set_budget',
  'activate',
  'create_campaign',
  'duplicate_campaign',
]);

export function requiresApproval(action: string): boolean {
  return RISKY_ACTIONS.has(action);
}

export type RiskyAction = 'set_budget' | 'activate' | 'create_campaign' | 'duplicate_campaign';
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test approval-policy`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/approval-policy.ts src/lib/__tests__/approval-policy.test.ts
git commit -m "feat: approval policy classifier with tests"
```

---

### Task 2.2: `proposal-validators.ts` (Zod schemas)

**Files:**
- Create: `src/lib/proposal-validators.ts`
- Test: `src/lib/__tests__/proposal-validators.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/__tests__/proposal-validators.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateBudgetPayload,
  validateActivatePayload,
  validateCreateCampaignPayload,
} from '../proposal-validators';

describe('validateBudgetPayload', () => {
  it('accepts valid daily budget', () => {
    const r = validateBudgetPayload({ object_id: '123', amount: 50, type: 'daily' });
    expect(r.success).toBe(true);
  });
  it('rejects amount > cap', () => {
    const r = validateBudgetPayload({ object_id: '123', amount: 2000, type: 'daily' });
    expect(r.success).toBe(false);
  });
  it('rejects invalid object_id', () => {
    const r = validateBudgetPayload({ object_id: 'abc!', amount: 50, type: 'daily' });
    expect(r.success).toBe(false);
  });
  it('rejects unknown type', () => {
    const r = validateBudgetPayload({ object_id: '123', amount: 50, type: 'monthly' });
    expect(r.success).toBe(false);
  });
});

describe('validateActivatePayload', () => {
  it('accepts valid object_id', () => {
    expect(validateActivatePayload({ object_id: '999' }).success).toBe(true);
  });
});

describe('validateCreateCampaignPayload', () => {
  it('accepts complete payload', () => {
    const r = validateCreateCampaignPayload({
      account_id: 'act_123',
      campaign_name: 'Test',
      objective: 'OUTCOME_LEADS',
      adset_name: 'AS',
      budget_amount: 50,
      budget_type: 'daily',
      page_id: '111',
      targeting: { age_min: 25 },
      ad_name: 'Ad',
      headline: 'H',
      message: 'M',
      image_hash: 'abc123',
    });
    expect(r.success).toBe(true);
  });
  it('rejects missing required fields', () => {
    expect(validateCreateCampaignPayload({ campaign_name: 'X' }).success).toBe(false);
  });
  it('rejects budget over cap', () => {
    const r = validateCreateCampaignPayload({
      account_id: 'act_123', campaign_name: 'T', objective: 'OUTCOME_LEADS',
      adset_name: 'A', budget_amount: 5000, budget_type: 'daily',
      page_id: '1', targeting: {}, ad_name: 'A', headline: 'H', message: 'M', image_hash: 'h',
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test proposal-validators`
Expected: FAIL module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/proposal-validators.ts
import { z } from 'zod';

const CAP = Number(process.env.BUDGET_CAP_USD || 1000);
const ID = z.string().regex(/^\d+$/, 'object_id must be digits only');
const ACCT = z.string().regex(/^act_\d+$/, 'account_id must match act_\\d+');

export const BudgetPayloadSchema = z.object({
  object_id: ID,
  amount: z.number().positive().max(CAP),
  type: z.enum(['daily', 'lifetime']),
});

export const ActivatePayloadSchema = z.object({
  object_id: ID,
});

export const CreateCampaignPayloadSchema = z.object({
  account_id: ACCT,
  campaign_name: z.string().min(1).max(200),
  objective: z.string().min(1),
  adset_name: z.string().min(1).max(200),
  budget_amount: z.number().positive().max(CAP),
  budget_type: z.enum(['daily', 'lifetime']),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  page_id: z.string().regex(/^\d+$/),
  instagram_user_id: z.string().regex(/^\d+$/).optional(),
  targeting: z.record(z.string(), z.unknown()),
  ad_name: z.string().min(1).max(200),
  headline: z.string().min(1).max(200),
  description: z.string().max(200).optional(),
  message: z.string().min(1).max(2000),
  image_hash: z.string().min(1),
  lead_gen_form_id: z.string().regex(/^\d+$/).optional(),
  call_to_action: z.string().optional(),
});

export function validateBudgetPayload(input: unknown) {
  return BudgetPayloadSchema.safeParse(input);
}
export function validateActivatePayload(input: unknown) {
  return ActivatePayloadSchema.safeParse(input);
}
export function validateCreateCampaignPayload(input: unknown) {
  return CreateCampaignPayloadSchema.safeParse(input);
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test proposal-validators`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/proposal-validators.ts src/lib/__tests__/proposal-validators.test.ts
git commit -m "feat: zod validators per proposal action"
```


---

### Task 2.3: `proposal-store.ts` (Postgres CRUD)

**Files:**
- Create: `src/lib/proposal-store.ts`
- Test: `src/lib/__tests__/proposal-store.test.ts`

This file talks to Postgres via `@vercel/postgres`. Tests mock the `sql` import.

- [ ] **Step 1: Write failing test (with sql mock)**

```ts
// src/lib/__tests__/proposal-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@vercel/postgres', () => ({
  sql: Object.assign(mockSql, { query: mockSql }),
}));

import {
  insertProposal,
  getProposal,
  listProposals,
  updateProposalStatus,
  expireStaleProposals,
} from '../proposal-store';

beforeEach(() => mockSql.mockReset());

describe('insertProposal', () => {
  it('inserts row with computed expires_at +72h', async () => {
    mockSql.mockResolvedValue({ rows: [{ id: 'uuid-1', expires_at: new Date() }] });
    const r = await insertProposal({
      proposed_by: 'a@b.com',
      account_id: 'act_1',
      action: 'set_budget',
      scope: 'campaign',
      scope_id: '123',
      scope_name: 'Camp',
      payload: { amount: 50, type: 'daily', object_id: '123' },
      current_state: { amount: 30 },
    });
    expect(r.id).toBe('uuid-1');
    expect(mockSql).toHaveBeenCalled();
  });
});

describe('listProposals', () => {
  it('filters by status', async () => {
    mockSql.mockResolvedValue({ rows: [] });
    await listProposals({ status: 'pending' });
    expect(mockSql).toHaveBeenCalled();
  });
});

describe('updateProposalStatus', () => {
  it('returns null if not found', async () => {
    mockSql.mockResolvedValue({ rows: [] });
    const r = await updateProposalStatus('missing', { status: 'rejected', decided_by: 'a@b.com' });
    expect(r).toBeNull();
  });
});

describe('expireStaleProposals', () => {
  it('returns count of expired rows', async () => {
    mockSql.mockResolvedValue({ rowCount: 3, rows: [] });
    const n = await expireStaleProposals();
    expect(n).toBe(3);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test proposal-store`
Expected: FAIL module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/proposal-store.ts
import { sql } from '@vercel/postgres';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'expired';
export type ProposalAction = 'set_budget' | 'activate' | 'create_campaign' | 'duplicate_campaign';

export interface Proposal {
  id: string;
  created_at: string;
  expires_at: string;
  proposed_by: string;
  account_id: string;
  action: ProposalAction;
  scope: string;
  scope_id: string | null;
  scope_name: string | null;
  payload: Record<string, unknown>;
  current_state: Record<string, unknown> | null;
  reason: string | null;
  status: ProposalStatus;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  executed_at: string | null;
  meta_response: Record<string, unknown> | null;
  error: string | null;
}

export interface InsertProposalInput {
  proposed_by: string;
  account_id: string;
  action: ProposalAction;
  scope: string;
  scope_id?: string | null;
  scope_name?: string | null;
  payload: Record<string, unknown>;
  current_state?: Record<string, unknown> | null;
  reason?: string | null;
  expires_at?: Date;
}

const EXPIRY_HOURS = 72;

export async function insertProposal(input: InsertProposalInput): Promise<{ id: string }> {
  const expires = input.expires_at ?? new Date(Date.now() + EXPIRY_HOURS * 3600_000);
  const r = await sql.query<{ id: string }>(
    `INSERT INTO mutation_proposals
      (proposed_by, account_id, action, scope, scope_id, scope_name, payload, current_state, reason, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id`,
    [
      input.proposed_by,
      input.account_id,
      input.action,
      input.scope,
      input.scope_id ?? null,
      input.scope_name ?? null,
      JSON.stringify(input.payload),
      input.current_state ? JSON.stringify(input.current_state) : null,
      input.reason ?? null,
      expires.toISOString(),
    ]
  );
  return { id: r.rows[0].id };
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const r = await sql.query<Proposal>(`SELECT * FROM mutation_proposals WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

export interface ListFilter {
  status?: ProposalStatus | ProposalStatus[];
  action?: ProposalAction;
  account_id?: string;
  limit?: number;
  offset?: number;
}

export async function listProposals(filter: ListFilter = {}): Promise<Proposal[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (filter.status) {
    const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
    conds.push(`status = ANY($${i++}::proposal_status[])`);
    params.push(arr);
  }
  if (filter.action) { conds.push(`action = $${i++}`); params.push(filter.action); }
  if (filter.account_id) { conds.push(`account_id = $${i++}`); params.push(filter.account_id); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const limit = Math.min(filter.limit ?? 200, 500);
  const offset = filter.offset ?? 0;
  const q = `SELECT * FROM mutation_proposals ${where}
             ORDER BY (status = 'pending') DESC, created_at DESC
             LIMIT ${limit} OFFSET ${offset}`;
  const r = await sql.query<Proposal>(q, params);
  return r.rows;
}

export async function countPending(account_id?: string): Promise<number> {
  const r = account_id
    ? await sql.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM mutation_proposals WHERE status='pending' AND account_id=$1`,
        [account_id]
      )
    : await sql.query<{ count: string }>(`SELECT count(*)::text AS count FROM mutation_proposals WHERE status='pending'`);
  return Number(r.rows[0]?.count ?? 0);
}

export interface StatusUpdate {
  status: ProposalStatus;
  decided_by?: string;
  decision_note?: string;
  meta_response?: Record<string, unknown>;
  error?: string;
  executed_at?: Date;
}

export async function updateProposalStatus(id: string, u: StatusUpdate): Promise<Proposal | null> {
  const r = await sql.query<Proposal>(
    `UPDATE mutation_proposals SET
       status = $2,
       decided_at = COALESCE(decided_at, CASE WHEN $2 IN ('approved','rejected') THEN now() ELSE decided_at END),
       decided_by = COALESCE(decided_by, $3),
       decision_note = COALESCE(decision_note, $4),
       meta_response = COALESCE($5::jsonb, meta_response),
       error = COALESCE($6, error),
       executed_at = COALESCE($7, executed_at)
     WHERE id = $1
     RETURNING *`,
    [
      id, u.status, u.decided_by ?? null, u.decision_note ?? null,
      u.meta_response ? JSON.stringify(u.meta_response) : null,
      u.error ?? null,
      u.executed_at?.toISOString() ?? null,
    ]
  );
  return r.rows[0] ?? null;
}

/**
 * Approve flow with FOR UPDATE lock. Returns proposal if locked, null if unavailable.
 */
export async function lockPendingForApproval(id: string): Promise<Proposal | null> {
  const r = await sql.query<Proposal>(
    `SELECT * FROM mutation_proposals
     WHERE id = $1 AND status = 'pending' AND expires_at > now()
     FOR UPDATE`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function expireStaleProposals(): Promise<number> {
  const r = await sql.query(
    `UPDATE mutation_proposals SET status='expired'
     WHERE status='pending' AND expires_at < now()`
  );
  return r.rowCount ?? 0;
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test proposal-store`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/proposal-store.ts src/lib/__tests__/proposal-store.test.ts
git commit -m "feat(db): proposal store CRUD with Postgres"
```


---

### Task 2.4: `proposal-executor.ts`

**Files:**
- Create: `src/lib/proposal-executor.ts`
- Test: `src/lib/__tests__/proposal-executor.test.ts`

Executor takes an approved proposal and runs the corresponding Meta API mutation. Validation re-runs at execute time (in case cap was lowered between propose and approve).

- [ ] **Step 1: Write failing test**

```ts
// src/lib/__tests__/proposal-executor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const setBudget = vi.fn();
const setStatus = vi.fn();
const createWizard = vi.fn();

vi.mock('@/lib/meta-api', () => ({
  setBudget: (...a: unknown[]) => setBudget(...a),
  setStatus: (...a: unknown[]) => setStatus(...a),
  createCampaignWizard: (...a: unknown[]) => createWizard(...a),
}));

import { executeProposal } from '../proposal-executor';
import type { Proposal } from '../proposal-store';

const baseProp: Proposal = {
  id: 'p1', created_at: '', expires_at: '', proposed_by: 'a',
  account_id: 'act_1', action: 'set_budget', scope: 'campaign',
  scope_id: '123', scope_name: 'C', payload: {}, current_state: null,
  reason: null, status: 'approved', decided_at: null, decided_by: null,
  decision_note: null, executed_at: null, meta_response: null, error: null,
};

beforeEach(() => { setBudget.mockReset(); setStatus.mockReset(); createWizard.mockReset(); });

describe('executeProposal', () => {
  it('calls setBudget for set_budget action', async () => {
    setBudget.mockResolvedValue({ ok: true });
    const r = await executeProposal({ ...baseProp,
      payload: { object_id: '123', amount: 50, type: 'daily' } });
    expect(setBudget).toHaveBeenCalledWith('123', 50, 'daily');
    expect(r.ok).toBe(true);
  });
  it('calls setStatus ACTIVE for activate', async () => {
    setStatus.mockResolvedValue({ ok: true });
    await executeProposal({ ...baseProp, action: 'activate',
      payload: { object_id: '123' } });
    expect(setStatus).toHaveBeenCalledWith('123', 'ACTIVE');
  });
  it('rejects payload that fails validation', async () => {
    const r = await executeProposal({ ...baseProp,
      payload: { object_id: 'abc!', amount: 5, type: 'daily' } });
    expect(r.ok).toBe(false);
    expect(setBudget).not.toHaveBeenCalled();
  });
  it('returns error on Meta API throw', async () => {
    setBudget.mockRejectedValue(new Error('Meta down'));
    const r = await executeProposal({ ...baseProp,
      payload: { object_id: '123', amount: 50, type: 'daily' } });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Meta down');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test proposal-executor`
Expected: FAIL module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/proposal-executor.ts
import { setBudget, setStatus, createCampaignWizard } from './meta-api';
import {
  validateBudgetPayload,
  validateActivatePayload,
  validateCreateCampaignPayload,
} from './proposal-validators';
import type { Proposal } from './proposal-store';

export interface ExecutionResult {
  ok: boolean;
  meta_response?: Record<string, unknown>;
  error?: string;
}

export async function executeProposal(p: Proposal): Promise<ExecutionResult> {
  try {
    switch (p.action) {
      case 'set_budget': {
        const v = validateBudgetPayload(p.payload);
        if (!v.success) return { ok: false, error: 'Payload invalid: ' + v.error.message };
        const r = await setBudget(v.data.object_id, v.data.amount, v.data.type);
        return { ok: true, meta_response: (r as Record<string, unknown>) ?? {} };
      }
      case 'activate': {
        const v = validateActivatePayload(p.payload);
        if (!v.success) return { ok: false, error: 'Payload invalid: ' + v.error.message };
        const r = await setStatus(v.data.object_id, 'ACTIVE');
        return { ok: true, meta_response: (r as Record<string, unknown>) ?? {} };
      }
      case 'create_campaign':
      case 'duplicate_campaign': {
        const v = validateCreateCampaignPayload(p.payload);
        if (!v.success) return { ok: false, error: 'Payload invalid: ' + v.error.message };
        const r = await createCampaignWizard(v.data);
        return { ok: true, meta_response: r as Record<string, unknown> };
      }
      default:
        return { ok: false, error: `Unknown action: ${p.action}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test proposal-executor`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/proposal-executor.ts src/lib/__tests__/proposal-executor.test.ts
git commit -m "feat: proposal executor with revalidation"
```


---

## Phase 3: API routes

Helper for auth check, used by all proposal routes.

### Task 3.1: Auth helper for API routes

**Files:**
- Create: `src/lib/api-auth.ts`
- Test: `src/lib/__tests__/api-auth.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/__tests__/api-auth.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => name === 'croman_ads_session' ? { value: 'good' } : undefined,
  }),
}));

vi.mock('../auth', () => ({
  verifySessionToken: vi.fn(async (t: string) => t === 'good' ? { email: 'a@b.com' } : null),
  SESSION_CONFIG: { cookieName: 'croman_ads_session' },
}));

import { requireSession } from '../api-auth';

describe('requireSession', () => {
  it('returns session for valid token', async () => {
    const s = await requireSession();
    expect(s).toEqual({ email: 'a@b.com' });
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test api-auth`
Expected: FAIL module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/api-auth.ts
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_CONFIG } from './auth';

export async function requireSession(): Promise<{ email: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_CONFIG.cookieName)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test api-auth`

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-auth.ts src/lib/__tests__/api-auth.test.ts
git commit -m "feat: server-side session helper for api routes"
```

---

### Task 3.2: `GET /api/proposals` (list)

**Files:**
- Create: `src/app/api/proposals/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/proposals/route.ts
import { NextResponse } from 'next/server';
import { listProposals, countPending } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const account_id = url.searchParams.get('account_id') ?? undefined;
  const countOnly = url.searchParams.get('count') === 'true';

  try {
    if (countOnly) {
      const n = await countPending(account_id);
      return NextResponse.json({ count: n });
    }
    const data = await listProposals({
      status: status as 'pending' | undefined,
      action: action as 'set_budget' | undefined,
      account_id,
      limit: Number(url.searchParams.get('limit') || 200),
      offset: Number(url.searchParams.get('offset') || 0),
    });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: compile success.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/proposals/route.ts
git commit -m "feat(api): GET /api/proposals list+count"
```

---

### Task 3.3: `GET /api/proposals/[id]`

**Files:**
- Create: `src/app/api/proposals/[id]/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/proposals/[id]/route.ts
import { NextResponse } from 'next/server';
import { getProposal } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  try {
    const p = await getProposal(id);
    if (!p) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: p });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/proposals/[id]/route.ts
git commit -m "feat(api): GET /api/proposals/[id]"
```

---

### Task 3.4: `POST /api/proposals/[id]/approve`

**Files:**
- Create: `src/app/api/proposals/[id]/approve/route.ts`

- [ ] **Step 1: Implement with FOR UPDATE lock + execute**

```ts
// src/app/api/proposals/[id]/approve/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { lockPendingForApproval, updateProposalStatus } from '@/lib/proposal-store';
import { executeProposal } from '@/lib/proposal-executor';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note : undefined;

  try {
    // Lock + transition inside a transaction
    await sql.query('BEGIN');
    const proposal = await lockPendingForApproval(id);
    if (!proposal) {
      await sql.query('ROLLBACK');
      return NextResponse.json({ error: 'No disponible (procesado/expirado)' }, { status: 409 });
    }
    await updateProposalStatus(id, {
      status: 'approved',
      decided_by: session.email,
      decision_note: note,
    });
    await sql.query('COMMIT');

    // Execute outside transaction
    const exec = await executeProposal(proposal);
    if (exec.ok) {
      const r = await updateProposalStatus(id, {
        status: 'executed',
        meta_response: exec.meta_response,
        executed_at: new Date(),
      });
      return NextResponse.json({ ok: true, data: r });
    } else {
      const r = await updateProposalStatus(id, { status: 'failed', error: exec.error });
      return NextResponse.json({ ok: false, error: exec.error, data: r }, { status: 502 });
    }
  } catch (e) {
    try { await sql.query('ROLLBACK'); } catch {}
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/proposals/[id]/approve/route.ts
git commit -m "feat(api): approve + execute with locking transaction"
```

---

### Task 3.5: `POST /api/proposals/[id]/reject`

**Files:**
- Create: `src/app/api/proposals/[id]/reject/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/proposals/[id]/reject/route.ts
import { NextResponse } from 'next/server';
import { getProposal, updateProposalStatus } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note : undefined;
  try {
    const p = await getProposal(id);
    if (!p) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (p.status !== 'pending') {
      return NextResponse.json({ error: `Estado ${p.status}, no se puede rechazar` }, { status: 409 });
    }
    const r = await updateProposalStatus(id, {
      status: 'rejected',
      decided_by: session.email,
      decision_note: note,
    });
    return NextResponse.json({ ok: true, data: r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/proposals/[id]/reject/route.ts
git commit -m "feat(api): reject proposal"
```

---

### Task 3.6: `POST /api/proposals/expire` (cron)

**Files:**
- Create: `src/app/api/proposals/expire/route.ts`

- [ ] **Step 1: Implement with CRON_SECRET check**

```ts
// src/app/api/proposals/expire/route.ts
import { NextResponse } from 'next/server';
import { expireStaleProposals } from '@/lib/proposal-store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const n = await expireStaleProposals();
    return NextResponse.json({ ok: true, expired: n });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/proposals/expire/route.ts
git commit -m "feat(api): cron expire stale proposals"
```


---

## Phase 4: Interceptor — modify existing mutation routes

### Task 4.1: Intercept `/api/mutation/budget`

**Files:**
- Modify: `src/app/api/mutation/budget/route.ts`

- [ ] **Step 1: Read current budget for snapshot (helper)**

Add helper to `src/lib/meta-api.ts`. Append at end:

```ts
export async function getCurrentBudget(objectId: string): Promise<{ amount: number; type: 'daily' | 'lifetime' } | null> {
  const r = await metaGet(`/${objectId}`, { fields: 'daily_budget,lifetime_budget' }, { paginate: false });
  const row = (Array.isArray(r.data) ? r.data[0] : r) as { daily_budget?: string; lifetime_budget?: string };
  if (row?.daily_budget) return { amount: Number(row.daily_budget) / 100, type: 'daily' };
  if (row?.lifetime_budget) return { amount: Number(row.lifetime_budget) / 100, type: 'lifetime' };
  return null;
}
```

- [ ] **Step 2: Update route with interceptor**

Replace `src/app/api/mutation/budget/route.ts` body:

```ts
import { NextResponse } from 'next/server';
import { setBudget, getCurrentBudget } from '@/lib/meta-api';
import { requiresApproval } from '@/lib/approval-policy';
import { insertProposal } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const MAX_BUDGET_USD = Number(process.env.BUDGET_CAP_USD || 1000);

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { object_id, amount, type, account_id, scope_name } = await req.json();
    if (!object_id || amount === undefined || amount === null || !type) {
      return NextResponse.json({ error: 'object_id + amount + type required' }, { status: 400 });
    }
    if (!['daily', 'lifetime'].includes(type)) {
      return NextResponse.json({ error: 'type must be daily or lifetime' }, { status: 400 });
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }
    if (num > MAX_BUDGET_USD) {
      return NextResponse.json(
        { error: `Excede tope USD ${MAX_BUDGET_USD}`, cap: MAX_BUDGET_USD },
        { status: 422 }
      );
    }
    if (typeof object_id !== 'string' || !/^\d+$/.test(object_id)) {
      return NextResponse.json({ error: 'object_id inválido' }, { status: 400 });
    }

    if (requiresApproval('set_budget')) {
      const snapshot = await getCurrentBudget(object_id).catch(() => null);
      const proposal = await insertProposal({
        proposed_by: session.email,
        account_id: account_id || 'unknown',
        action: 'set_budget',
        scope: 'campaign',
        scope_id: object_id,
        scope_name: scope_name || object_id,
        payload: { object_id, amount: num, type },
        current_state: snapshot ?? undefined,
      });
      return NextResponse.json(
        { status: 'pending', proposal_id: proposal.id, message: 'Encolado para aprobación' },
        { status: 202 }
      );
    }

    // safe path (unreachable while set_budget stays risky, kept for future flexibility)
    const result = await setBudget(object_id, num, type);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mutation/budget/route.ts src/lib/meta-api.ts
git commit -m "feat(intercept): budget mutation goes through approval queue"
```

---

### Task 4.2: Intercept `/api/mutation/status` (only for ACTIVE)

**Files:**
- Modify: `src/app/api/mutation/status/route.ts`

- [ ] **Step 1: Update route**

```ts
import { NextResponse } from 'next/server';
import { setStatus } from '@/lib/meta-api';
import { requiresApproval } from '@/lib/approval-policy';
import { insertProposal } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { object_id, status, account_id, scope_name, scope } = await req.json();
    if (!object_id || !status) {
      return NextResponse.json({ error: 'object_id + status required' }, { status: 400 });
    }
    if (typeof object_id !== 'string' || !/^\d+$/.test(object_id)) {
      return NextResponse.json({ error: 'object_id inválido' }, { status: 400 });
    }

    const upper = String(status).toUpperCase();
    if (upper === 'ACTIVE' && requiresApproval('activate')) {
      const proposal = await insertProposal({
        proposed_by: session.email,
        account_id: account_id || 'unknown',
        action: 'activate',
        scope: scope || 'campaign',
        scope_id: object_id,
        scope_name: scope_name || object_id,
        payload: { object_id },
        current_state: { status: 'PAUSED' },
      });
      return NextResponse.json(
        { status: 'pending', proposal_id: proposal.id, message: 'Activación encolada' },
        { status: 202 }
      );
    }

    // PAUSED path runs directly (no approval needed)
    const result = await setStatus(object_id, upper);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/mutation/status/route.ts
git commit -m "feat(intercept): activate mutation goes through approval"
```

---

### Task 4.3: Intercept `/api/campaign/create`

**Files:**
- Modify: `src/app/api/campaign/create/route.ts`

- [ ] **Step 1: Update route — store payload as pending instead of executing**

```ts
import { NextResponse } from 'next/server';
import { createCampaignWizard } from '@/lib/meta-api';
import { requiresApproval } from '@/lib/approval-policy';
import { insertProposal } from '@/lib/proposal-store';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const required = [
      'account_id', 'campaign_name', 'objective', 'adset_name',
      'budget_amount', 'budget_type', 'page_id', 'targeting',
      'ad_name', 'headline', 'message', 'image_hash',
    ];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        return NextResponse.json({ error: `${k} required` }, { status: 400 });
      }
    }

    if (requiresApproval('create_campaign')) {
      const proposal = await insertProposal({
        proposed_by: session.email,
        account_id: body.account_id,
        action: 'create_campaign',
        scope: 'account',
        scope_id: null,
        scope_name: body.campaign_name,
        payload: body,
        current_state: null,
      });
      return NextResponse.json(
        { status: 'pending', proposal_id: proposal.id, message: 'Creación encolada' },
        { status: 202 }
      );
    }

    const result = await createCampaignWizard(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/campaign/create/route.ts
git commit -m "feat(intercept): campaign creation goes through approval"
```


---

## Phase 5: UI components and pages

### Task 5.1: `useApprovalCount` hook

**Files:**
- Create: `src/lib/use-approval-count.ts`

- [ ] **Step 1: Implement**

```ts
'use client';

import { useEffect, useState } from 'react';

export function useApprovalCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const r = await fetch('/api/proposals?count=true');
        const j = await r.json();
        if (!stop && typeof j.count === 'number') setCount(j.count);
      } catch {}
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => { stop = true; clearInterval(id); };
  }, []);
  return count;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/use-approval-count.ts
git commit -m "feat(ui): useApprovalCount poll hook"
```

---

### Task 5.2: `DiffViewer` component

**Files:**
- Create: `src/components/DiffViewer.tsx`

- [ ] **Step 1: Implement dispatcher per action**

```tsx
'use client';

import type { Proposal } from '@/lib/proposal-store';
import { fmtUSD } from '@/lib/utils';

export function DiffViewer({ proposal }: { proposal: Proposal }) {
  if (proposal.action === 'set_budget') return <BudgetDiff p={proposal} />;
  if (proposal.action === 'activate') return <ActivateDiff p={proposal} />;
  return <CreateCampaignDiff p={proposal} />;
}

function BudgetDiff({ p }: { p: Proposal }) {
  const cur = p.current_state as { amount?: number; type?: string } | null;
  const next = p.payload as { amount: number; type: string };
  const before = cur?.amount ?? 0;
  const after = next.amount;
  const delta = after - before;
  const pct = before ? ((delta / before) * 100).toFixed(0) : '∞';
  return (
    <div className="font-[family-name:var(--font-mono)] text-sm">
      <span className="text-[var(--fg-muted)]">{fmtUSD(before)}</span>
      <span className="mx-2 text-[var(--fg-faint)]">→</span>
      <span className="text-[var(--fg)] font-semibold">{fmtUSD(after)}</span>
      <span className={`ml-3 ${delta > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
        ({delta > 0 ? '+' : ''}{fmtUSD(Math.abs(delta))} · {pct}%)
      </span>
      <span className="ml-3 text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)]">{next.type}</span>
    </div>
  );
}

function ActivateDiff({ p }: { p: Proposal }) {
  return (
    <div className="font-[family-name:var(--font-mono)] text-sm flex items-center gap-2">
      <span className="dot dot-warning" />
      <span className="text-[var(--fg-muted)]">PAUSED</span>
      <span className="text-[var(--fg-faint)]">→</span>
      <span className="dot dot-success" />
      <span className="text-[var(--fg)] font-semibold">ACTIVE</span>
    </div>
  );
}

function CreateCampaignDiff({ p }: { p: Proposal }) {
  const body = p.payload as Record<string, unknown>;
  const rows: Array<[string, string]> = [
    ['Campaña', String(body.campaign_name ?? '')],
    ['Objetivo', String(body.objective ?? '')],
    ['Ad Set', String(body.adset_name ?? '')],
    ['Presupuesto', `${fmtUSD(Number(body.budget_amount ?? 0))} ${body.budget_type}`],
    ['Page', String(body.page_id ?? '')],
    ['Ad', String(body.ad_name ?? '')],
    ['Headline', String(body.headline ?? '')],
  ];
  return (
    <div className="space-y-1 text-sm font-[family-name:var(--font-mono)]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-muted)] self-center">{k}</span>
          <span className="text-[var(--fg)] truncate">{v}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DiffViewer.tsx
git commit -m "feat(ui): DiffViewer dispatcher per action"
```

---

### Task 5.3: `ApprovalCard` component

**Files:**
- Create: `src/components/ApprovalCard.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useState } from 'react';
import type { Proposal } from '@/lib/proposal-store';
import { DiffViewer } from './DiffViewer';
import { Check, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const ACTION_LABEL: Record<string, string> = {
  set_budget: 'Subir/bajar presupuesto',
  activate: 'Activar anuncio',
  create_campaign: 'Crear campaña',
  duplicate_campaign: 'Duplicar campaña',
};

function hoursLeft(expires_at: string): number {
  const ms = new Date(expires_at).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 3600_000));
}

interface Props {
  proposal: Proposal;
  onChange: () => void;
}

export function ApprovalCard({ proposal, onChange }: Props) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hrs = hoursLeft(proposal.expires_at);
  const urgent = hrs < 12;
  const isPending = proposal.status === 'pending';

  async function act(kind: 'approve' | 'reject') {
    setBusy(kind);
    setError(null);
    try {
      const r = await fetch(`/api/proposals/${proposal.id}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok && !j.ok) throw new Error(j.error || 'Error');
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`dot ${
              proposal.status === 'pending' ? 'dot-warning' :
              proposal.status === 'executed' ? 'dot-success' :
              proposal.status === 'failed' ? 'dot-danger' : 'dot-muted'
            }`} />
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--fg-muted)]">
              {proposal.status}
            </span>
            {isPending && (
              <span className={`text-[10px] ${urgent ? 'text-[var(--danger)] font-bold' : 'text-[var(--fg-muted)]'}`}>
                · expira en {hrs}h
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-[var(--fg)]">
            {ACTION_LABEL[proposal.action]} · {proposal.scope_name}
          </h3>
          <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">
            propuesto por {proposal.proposed_by} · {new Date(proposal.created_at).toLocaleString('es')}
          </p>
        </div>
        <Link
          href={`/approvals/${proposal.id}`}
          className="text-[var(--fg-muted)] hover:text-[var(--fg)] flex items-center gap-1 text-xs"
        >
          Detalle <ChevronRight size={12} />
        </Link>
      </div>

      <div className="mb-4 py-3 px-4 bg-[var(--surface)] border border-[var(--hairline)] rounded">
        <DiffViewer proposal={proposal} />
      </div>

      {error && (
        <div className="text-[var(--danger)] text-xs mb-2">{error}</div>
      )}

      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={() => act('approve')}
            disabled={busy !== null}
            className="btn-primary px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Check size={14} />
            {busy === 'approve' ? 'Aprobando…' : 'Aprobar'}
          </button>
          <button
            onClick={() => act('reject')}
            disabled={busy !== null}
            className="btn-danger px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <X size={14} />
            Rechazar
          </button>
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ApprovalCard.tsx
git commit -m "feat(ui): ApprovalCard with diff + actions"
```

---

### Task 5.4: `/approvals` page

**Files:**
- Create: `src/app/approvals/page.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ApprovalCard } from '@/components/ApprovalCard';
import { useAccount } from '@/lib/use-account';
import type { Proposal } from '@/lib/proposal-store';
import { RefreshCw } from 'lucide-react';

type Tab = 'pending' | 'history';

export default function ApprovalsPage() {
  const { account, setAccount } = useAccount();
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tab === 'pending') params.set('status', 'pending');
      const r = await fetch(`/api/proposals?${params}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setItems(j.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const filtered = tab === 'history'
    ? items.filter((p) => p.status !== 'pending')
    : items;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full space-y-6">
          <div className="flex items-end justify-between flex-wrap gap-4 fade-in">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">Cola de aprobación</p>
              <h1 className="display text-5xl text-[var(--fg)]">Aprobaciones</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-2">
                Todas las mutaciones risky (presupuesto, activar, crear campaña) requieren tu OK.
              </p>
            </div>
            <button onClick={load} disabled={loading} className="btn-ghost px-3 py-2 rounded text-xs flex items-center gap-2">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Recargar
            </button>
          </div>

          <div className="flex border-b border-[var(--hairline)]">
            {(['pending', 'history'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  tab === t
                    ? 'border-[var(--accent)] text-[var(--fg)]'
                    : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
                }`}
              >
                {t === 'pending' ? 'Pendientes' : 'Histórico'}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-[oklch(0.65_0.20_25_/_0.1)] border border-[var(--danger)] text-[var(--danger)] px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {filtered.length === 0 && !loading ? (
            <div className="card p-12 text-center">
              <p className="display text-2xl text-[var(--fg)]">
                {tab === 'pending' ? 'Nada pendiente' : 'Sin histórico'}
              </p>
              <p className="text-sm text-[var(--fg-muted)] mt-2">
                {tab === 'pending'
                  ? 'No hay cambios esperando aprobación.'
                  : 'Aún no se decidió ninguna propuesta.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 stagger">
              {filtered.map((p) => (
                <ApprovalCard key={p.id} proposal={p} onChange={load} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/approvals/page.tsx
git commit -m "feat(ui): /approvals page with tabs"
```

---

### Task 5.5: `/approvals/[id]` detail page

**Files:**
- Create: `src/app/approvals/[id]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useEffect, useState, use } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ApprovalCard } from '@/components/ApprovalCard';
import { useAccount } from '@/lib/use-account';
import type { Proposal } from '@/lib/proposal-store';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { account, setAccount } = useAccount();
  const [p, setP] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch(`/api/proposals/${id}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setP(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[900px] mx-auto w-full space-y-6">
          <Link href="/approvals" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] flex items-center gap-1">
            <ArrowLeft size={14} /> Volver
          </Link>
          {error && <div className="text-[var(--danger)] text-sm">{error}</div>}
          {p && <ApprovalCard proposal={p} onChange={load} />}
          {p && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--fg)] mb-3">Detalle técnico</h3>
              <pre className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--fg-muted)] overflow-x-auto">
                {JSON.stringify(p, null, 2)}
              </pre>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/approvals/[id]/page.tsx
git commit -m "feat(ui): /approvals/[id] detail page"
```

---

### Task 5.6: Add `/approvals` to sidebar with badge

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add new nav entry**

In the `NAV` array, after `Alertas` add:
```ts
{ href: '/approvals', label: 'Aprobaciones', icon: ShieldCheck, showApprovalBadge: true },
```

Add import:
```ts
import { ShieldCheck } from 'lucide-react';
import { useApprovalCount } from '@/lib/use-approval-count';
```

Inside `Sidebar()` component:
```ts
const approvalCount = useApprovalCount();
```

Update NAV item type and render branch:
```ts
{showApprovalBadge && approvalCount > 0 && (
  <span className="bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
    {approvalCount > 99 ? '99+' : approvalCount}
  </span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(ui): sidebar entry + live badge for approvals"
```


---

## Phase 6: Client UX updates (toast handling)

### Task 6.1: Budget page handles `pending` response

**Files:**
- Modify: `src/app/budgets/page.tsx` (inside `save` function)

- [ ] **Step 1: Update save handler**

Find current `save` function in `BudgetsPage`. Replace the `try` block:

```ts
try {
  const r = await fetch('/api/mutation/budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object_id: item.id,
      amount,
      type,
      account_id: account,
      scope_name: item.name,
    }),
  });
  const j = await r.json();
  if (!r.ok && r.status !== 202) throw new Error(j.error || 'Error');
  if (j.status === 'pending') {
    push(`Encolado para aprobación · ${item.name}`, 'success');
  } else {
    push(`Presupuesto ${item.name}: ${fmtUSD(amount)}`, 'success');
  }
  setDrafts((d) => { const n = { ...d }; delete n[item.id]; return n; });
  load();
} catch (e) {
  push(e instanceof Error ? e.message : 'Error', 'error');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/budgets/page.tsx
git commit -m "feat(ui): budgets page handles pending response"
```

---

### Task 6.2: Campaigns page handles `pending` response

**Files:**
- Modify: `src/app/campaigns/page.tsx`

- [ ] **Step 1: Update `toggleStatus` action**

In the existing `action` callback for `setConfirm({ ..., action: async () => { ... } })` for `toggleStatus`, change the fetch handler to:

```ts
const r = await fetch('/api/mutation/status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    object_id: c.id,
    status: next,
    account_id: account,
    scope_name: c.name,
    scope: 'campaign',
  }),
});
const j = await r.json();
if (!r.ok && r.status !== 202) throw new Error(j.error || 'Error');
if (j.status === 'pending') {
  push(`Activación encolada · ${c.name}`, 'success');
} else {
  push(`Campaña ${next === 'ACTIVE' ? 'activada' : 'pausada'}`, 'success');
}
load();
```

- [ ] **Step 2: Commit**

```bash
git add src/app/campaigns/page.tsx
git commit -m "feat(ui): campaigns activate handles pending response"
```

---

### Task 6.3: Wizard handles `pending` response

**Files:**
- Modify: `src/app/campaigns/new/page.tsx`

- [ ] **Step 1: Update `submit` handler**

Replace the success branch:

```ts
const r = await fetch('/api/campaign/create', { ... });
const j = await r.json();
if (!r.ok && r.status !== 202) throw new Error(j.error || 'Error');
if (j.status === 'pending') {
  push('Campaña encolada para aprobación', 'success');
  setResult({ campaign_id: 'pending', adset_id: 'pending', ad_id: j.proposal_id });
} else {
  setResult({ campaign_id: j.campaign_id, adset_id: j.adset_id, ad_id: j.ad_id });
  push('Campaña creada (PAUSED)', 'success');
}
```

In the result-display section, branch on `campaign_id === 'pending'` to show alternative message linking to `/approvals/${result.ad_id}`.

- [ ] **Step 2: Commit**

```bash
git add src/app/campaigns/new/page.tsx
git commit -m "feat(ui): wizard handles pending response"
```

---

## Phase 7: Vercel cron + final config

### Task 7.1: `vercel.json` cron

**Files:**
- Create (or modify): `vercel.json`

- [ ] **Step 1: Create config**

```json
{
  "crons": [
    { "path": "/api/proposals/expire", "schedule": "0 */6 * * *" }
  ]
}
```

Note: Vercel cron sends Authorization header automatically only for Pro plan. For Hobby tier, route checks `CRON_SECRET` against bearer header. Verify deployment-side that `CRON_SECRET` env var is set.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(deploy): vercel cron for proposal expiration"
```

---

### Task 7.2: Update `SECURITY.md` and README

**Files:**
- Modify: `SECURITY.md`
- Modify: `README.md`

- [ ] **Step 1: Document approval layer in SECURITY.md**

Append section:

```md
## Approval workflow

All risky mutations require explicit approval before reaching Meta:

- set_budget, activate, create_campaign, duplicate_campaign
- Pending proposals stored in Postgres, expire in 72h
- Cron job clears expired
- FOR UPDATE lock prevents double-approve race
- All transitions audit-logged
```

- [ ] **Step 2: Document in README**

Add `/approvals` to routes table.

- [ ] **Step 3: Commit**

```bash
git add SECURITY.md README.md
git commit -m "docs: approval workflow"
```

---

### Task 7.3: Final build + push

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Set env vars in Vercel**

Manual (via Vercel dashboard):
- `CRON_SECRET` = `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Add Vercel Postgres add-on; env vars `POSTGRES_*` auto-injected.

- [ ] **Step 5: Run migration in production**

```bash
vercel env pull .env.local
npm run db:migrate
```

- [ ] **Step 6: Smoke test**

In Vercel preview/production:
1. Login.
2. Go to `/budgets`, change one budget by $5. Expect toast "Encolado".
3. Go to `/approvals`. See pending card with diff $X → $X+5.
4. Click `Aprobar`. Wait. Status → `executed`. Verify in Ads Manager.
5. Repeat reject flow with a different budget.

---

## Self-Review (writing-plans skill checklist)

**Spec coverage:**
- [x] Data model — Task 1.1
- [x] Risky action classifier — Task 2.1
- [x] Validators — Task 2.2
- [x] Store CRUD — Task 2.3
- [x] Executor — Task 2.4
- [x] Auth helper — Task 3.1
- [x] List API — Task 3.2
- [x] Detail API — Task 3.3
- [x] Approve API with lock — Task 3.4
- [x] Reject API — Task 3.5
- [x] Expire cron API — Task 3.6
- [x] Budget interceptor — Task 4.1
- [x] Activate interceptor — Task 4.2
- [x] Create interceptor — Task 4.3
- [x] useApprovalCount hook — Task 5.1
- [x] DiffViewer — Task 5.2
- [x] ApprovalCard — Task 5.3
- [x] /approvals list — Task 5.4
- [x] /approvals/[id] — Task 5.5
- [x] Sidebar badge — Task 5.6
- [x] Toast updates (budget, campaigns, wizard) — 6.1-6.3
- [x] Vercel cron config — Task 7.1
- [x] Docs + smoke — Task 7.2-7.3

**Placeholder scan:**
- No TBDs.
- No "add validation here" comments without code.
- Tests have actual assertions.

**Type consistency:**
- `Proposal`, `ProposalStatus`, `ProposalAction` exported from `proposal-store.ts`, used identically in executor, API routes, UI.
- `requiresApproval(action: string)` signature consistent everywhere.
- `insertProposal(input)` shape matches what API routes pass.

**Scope check:**
- This plan implements sub-project A (approval) and nothing else.
- Material library (B), AI generator (C), nanobanana (D), custom date picker (E), advanced analytics (F) explicitly excluded.

