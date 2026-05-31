import { sql } from '@vercel/postgres';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'expired';
export type ProposalAction = 'set_budget' | 'activate' | 'create_campaign' | 'duplicate_campaign' | 'create_audience' | 'create_lookalike' | 'upload_customer_list' | 'configure_capi';

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
