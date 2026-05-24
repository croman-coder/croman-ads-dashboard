# Approval Workflow — Design Spec

**Status:** Approved
**Date:** 2026-05-24
**Author:** Croman Coder (with Claude)
**Sub-project:** A of platform expansion (B: material library, C: AI generator, D: nanobanana)

## 1. Problem

Currently any authenticated admin can change campaign budgets, activate ads, create new campaigns, or duplicate them with a single click. These actions move real money and have no second-step confirmation beyond a basic UI dialog. There is no audit trail, no way to delegate proposal authority to a non-admin operator while keeping final approval centralized, and no protection against accidental high-impact changes (typo in budget input, accidental click, stale state).

The dashboard already runs on Vercel with JWT auth, bcrypt password, rate-limited login, CSP/HSTS headers, and a server-side `$1000` budget cap. The approval layer adds explicit two-step confirmation for the riskiest mutations while keeping low-risk operations (rename, pause) frictionless.

## 2. Goals

1. Block risky mutations from reaching Meta API until an authorized human reviews them.
2. Preserve full audit trail (who proposed, who decided, snapshot before, response after).
3. Zero changes to existing UI mutation buttons — interceptor returns a different status code that the toast handler interprets.
4. Resilient to: race conditions on approve, expired snapshots, Meta API failures, duplicate proposals.
5. Deployable on Vercel with native Postgres add-on.

## 3. Non-goals (out of scope this sub-project)

- Multi-user with roles (single admin v1)
- Email/Slack/WhatsApp notifications (badge count only)
- Automatic rollback on failure
- Approval thresholds (e.g. budgets < $X auto-approve)
- Batch approve / multi-select operations
- File/material uploads (sub-project B)
- AI campaign generation (sub-project C)

## 4. Risky actions (require approval)

| Action | Risk | Approval required |
|---|---|---|
| `set_budget` | Direct money impact | Yes |
| `activate` | Resumes spend | Yes |
| `create_campaign` | Launches new spend channel | Yes |
| `duplicate_campaign` | Same as create | Yes |
| `pause` | Reversible, stops spend | **No** (free) |
| `rename` | Cosmetic | **No** |
| `update_targeting` | Affects performance + indirect $ via CPL | **No** v1 (Q4 decision) — flagged for v2 reclassification |
| `update_placements` | Same | **No** v1 — same flag |
| `swap_lead_form` | No $ impact | **No** |

Classification lives in `src/lib/approval-policy.ts`:

```ts
const RISKY = new Set(['set_budget', 'activate', 'create_campaign', 'duplicate_campaign']);
export function requiresApproval(action: string): boolean {
  return RISKY.has(action);
}
```

Policy is server-side only. Clients cannot bypass.

## 5. Data model

Single table on Vercel Postgres. Append-only state transitions (no destructive updates).

```sql
CREATE TYPE proposal_status AS ENUM ('pending', 'approved', 'rejected', 'executed', 'failed', 'expired');
CREATE TYPE proposal_action AS ENUM ('set_budget', 'activate', 'create_campaign', 'duplicate_campaign');

CREATE TABLE mutation_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  proposed_by     TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  action          proposal_action NOT NULL,
  scope           TEXT NOT NULL,         -- 'campaign' | 'adset' | 'ad' | 'account'
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

CREATE INDEX idx_proposals_status_expires ON mutation_proposals(status, expires_at);
CREATE INDEX idx_proposals_account ON mutation_proposals(account_id, created_at DESC);
```

### State machine

```
pending --(approve)--> approved --(execute)--> executed
   |                      |                       |
   |                      v                       v
   +--(reject)--> rejected   +--(meta error)--> failed
   |
   +--(expire job)--> expired
```

Transitions are unidirectional except `failed` can lead to a new proposal via retry button.

## 6. API surface

### Modified routes (interceptor pattern)

`POST /api/mutation/budget`, `POST /api/mutation/status` (when status=ACTIVE), `POST /api/campaign/create`.

Pseudocode:

```ts
POST handler:
  validate inputs (existing)
  if requiresApproval(action):
    snapshot = await getCurrentState(scope_id)
    proposal = await db.proposals.insert({
      action, payload, current_state: snapshot,
      proposed_by: session.email, account_id, scope, scope_id, scope_name,
      expires_at: now() + 72h
    })
    return 202 Accepted { status: 'pending', proposal_id }
  else:
    execute Meta call
    return 200 { ok: true, result }
```

Dedupe: before insert, check for existing pending proposal with same `(account_id, action, scope_id, payload)` within last 5 min. Return existing id if match.

### New routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/proposals` | List, filters: `status`, `action`, `account_id`, `limit`, `offset` |
| `GET` | `/api/proposals/:id` | Detail with parsed diff |
| `POST` | `/api/proposals/:id/approve` | Approve + execute (atomic) |
| `POST` | `/api/proposals/:id/reject` | Reject (body: `{ note? }`) |
| `POST` | `/api/proposals/expire` | Cron job |

### Approve flow

```sql
BEGIN;
SELECT * FROM mutation_proposals
  WHERE id = $1 AND status = 'pending' AND expires_at > now()
  FOR UPDATE;
-- if no row: ROLLBACK + return 409 (or 410 if expired)
UPDATE ... SET status = 'approved', decided_at = now(), decided_by = $email, decision_note = $note;
COMMIT;

-- Outside transaction: execute Meta call
try {
  const r = await executor.execute(proposal);
  UPDATE ... SET status = 'executed', executed_at = now(), meta_response = r;
} catch (e) {
  UPDATE ... SET status = 'failed', error = e.message;
}
```

`FOR UPDATE` lock prevents double-approve race. Meta call outside transaction so DB connection isn't held while waiting for upstream.

### Cron

`vercel.json`:
```json
{ "crons": [{ "path": "/api/proposals/expire", "schedule": "0 */6 * * *" }] }
```

Job:
```sql
UPDATE mutation_proposals SET status = 'expired'
WHERE status = 'pending' AND expires_at < now();
```

Idempotent. Vercel cron auth via secret header (`CRON_SECRET` env).

## 7. UI

### `/approvals` page

Layout:
- Header: `Aprobaciones` title (display serif), live count badge.
- Tabs: `Pendientes (N)` · `Histórico` (approved/executed/rejected/failed/expired filterable).
- Filter chips: by action (Budget, Activate, Create), by account.
- Sort: oldest pending first (most urgent).
- List of `ApprovalCard` items.

`ApprovalCard`:
- Status dot + label (Pendiente · expira en 23h — red dot if <12h).
- Action + scope summary line: `Subir budget · campaign · GWM AON 2025 ASU`.
- `DiffViewer` showing change.
- Meta: propuesto por · hace 2h · reason (if present).
- Buttons: `Aprobar` (primary amber), `Rechazar` (ghost danger), `Detalle` link.

### `/approvals/[id]` detail page

- Full diff with side-by-side current_state vs payload.
- Audit timeline (created → approved → executed events).
- Meta API response (collapsible JSON for executed/failed).
- Same approve/reject actions if still pending.

### `DiffViewer` component

Renderer dispatch by action type:

```ts
function DiffViewer({ action, current_state, payload }) {
  switch (action) {
    case 'set_budget': return <BudgetDiff cur={current_state.amount} next={payload.amount} type={payload.type} />;
    case 'activate':   return <StatusDiff from="PAUSED" to="ACTIVE" />;
    case 'create_campaign':
    case 'duplicate_campaign': return <CampaignSpecDiff payload={payload} />;
  }
}
```

`BudgetDiff` renders `$60.00 → $120.00 (+$60, +100%)` in mono with delta color (green if down, amber if up >50%).

### Sidebar badge

New nav entry between `Alertas` and `Campañas` (or below Alertas). Badge uses same red-pill style as alerts. `useApprovalCount()` hook polls `/api/proposals?status=pending&count=true` every 30s while authenticated.

### Toast updates in existing pages

`/budgets` page submit handler:

```ts
const r = await fetch('/api/mutation/budget', {...});
const j = await r.json();
if (j.status === 'pending') {
  push('Encolado para aprobación · ver en Aprobaciones', 'info');
} else if (j.ok) {
  push('Presupuesto actualizado', 'success');
}
```

Same pattern in `/campaigns` activate action and new-campaign wizard final submit.

### Status badge in existing UI

Future enhancement (out of scope v1): show pending-proposal indicator next to campaigns/adsets with open proposals so user knows changes are queued.

## 8. Concurrency, errors, edge cases

### Race: simultaneous approve

`FOR UPDATE` lock. First request succeeds. Second sees `status != pending` → 409 Conflict with message "Esta propuesta ya fue procesada".

### Expired snapshot

Between propose and approve, user may have edited the object directly in Ads Manager. Solution:
1. On approve request, re-fetch current Meta state before locking.
2. If `current_meta_state != proposal.current_state` → return 409 with diff warning.
3. UI shows: "El estado actual ha cambiado desde la propuesta. ¿Aprobar igualmente?" — user can confirm with explicit force flag.

### Meta API failure during execute

Status moves `approved → failed`. Error message stored. `Reintentar` button in UI creates a new proposal with same payload (does not mutate original record). Max 3 retries per proposal chain (tracked via `retried_from` future field, not in v1).

### Dependent operations

`create_campaign` payload contains the full campaign + adset + ad spec. Executor creates them sequentially. If campaign created but adset fails:
- Status → `failed`, `error` records which step failed and the partial Meta ids.
- Manual cleanup required (no auto-rollback v1).

### Cap re-validation

Even though budget API validates `$1000` cap at proposal time, re-validate at execute time in case cap was lowered in env between propose and approve.

### Token expiration

Meta token may expire between propose and execute. Executor catches `OAuthException` and stores `error: 'Token expired, refresh required'`, status `failed`.

## 9. Security considerations

- All approval routes require valid session (existing middleware).
- `proposed_by` and `decided_by` derived from JWT, never from request body.
- Cron route `/api/proposals/expire` protected by `CRON_SECRET` header check (Vercel sends this automatically for crons).
- Postgres connection uses `POSTGRES_PRISMA_URL` (pooled) for requests, `POSTGRES_URL_NON_POOLING` for migrations.
- Input validation via Zod schemas on every route. Reject body that doesn't match expected shape.
- Rate limit on `/api/proposals/:id/approve` (10/min/IP) to prevent automated abuse.
- Audit log is append-only at app level (no DELETE statements in code). DB-level constraints not added v1.

## 10. Testing

### Unit (Vitest)

- `approval-policy.ts` — all action types covered.
- `proposal-validators.ts` — Zod schemas accept valid, reject invalid.
- `diff-renderer.tsx` — snapshot tests per action type.

### Integration

Postgres test database (testcontainers or `@vercel/postgres` local).

- `/api/mutation/budget` returns 202+pending for amount=$100, valid object.
- Same returns 422 for amount=$2000 (cap).
- `/api/proposals/:id/approve` happy path with mocked Meta API.
- Concurrent approve: only one succeeds, other gets 409.
- Expire job marks correct rows.
- Reject path stores decision_note.

### Mocks

`src/lib/__mocks__/meta-api.ts` — stubs all Meta API functions, records calls for assertion. Tests opt-in via `vi.mock()`.

### E2E (Playwright, post-implementation)

1. Login → /budgets → change budget → assert toast "Encolado"
2. Navigate /approvals → see card → click Aprobar → assert toast + status update
3. Reject flow similar
4. Expired proposal: manually set `expires_at` past, try to approve → assert 410 error UI

### Coverage target

- `lib/` pure: 90%
- `app/api/`: 80%
- UI: smoke + 1-2 happy paths per page

## 11. Migration / rollout

1. **Phase 1**: Schema migration (`scripts/db/migrate.ts`).
2. **Phase 2**: Implement proposal lib + API routes (no UI changes yet).
3. **Phase 3**: Add `/approvals` page + sidebar badge + diff viewer.
4. **Phase 4**: Wire interceptor into existing mutation routes one by one (budget first, then activate, then create).
5. **Phase 5**: Toast updates on existing pages.
6. **Phase 6**: Vercel cron deployment + manual smoke test.

Each phase is its own PR. After phase 4, approval is live for that action; remaining actions still bypass. Acceptable intermediate state.

## 12. Open questions / future

- Multi-user: when introduced, separation of duties (proposed_by ≠ decided_by) becomes configurable per action.
- Notification channels: email via Resend, Slack webhook, WhatsApp via Twilio. Sub-project for later.
- Approval policies / thresholds: budget < $50 auto-approve, $50-500 requires approval, >$500 requires double approval. Out of scope.
- Linking to alerts engine: future feature lets approved alerts auto-generate proposed fixes.

## 13. Acceptance criteria

Done when:
- [ ] Postgres table provisioned and migrated.
- [ ] All 5 risky-action routes intercept and create proposals.
- [ ] `/approvals` page lists pending + tabs work.
- [ ] Approve executes Meta call and updates DB atomically.
- [ ] Reject stores decision without calling Meta.
- [ ] Cron expires stale proposals.
- [ ] Sidebar badge shows live count.
- [ ] All toasts on existing pages handle pending response.
- [ ] Unit + integration tests pass with >80% coverage on touched code.
- [ ] SECURITY.md updated to document approval layer.
- [ ] No regressions in existing flows (pause, rename, targeting).

## 14. Variables de entorno

Existing + new:

```
POSTGRES_URL              (Vercel auto-injected)
POSTGRES_PRISMA_URL       (auto)
POSTGRES_URL_NON_POOLING  (auto)
CRON_SECRET               (manual, generate 32+ chars random)
```

## 15. Out-of-scope reminders

- File uploads → sub-project B
- AI prompt → campaign → sub-project C
- Image generation (nanobanana) → sub-project D
- Custom date range picker → sub-project E
- Failure analysis deep-drilldown → sub-project F
