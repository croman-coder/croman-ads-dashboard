import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export type Role = 'admin' | 'operator' | 'viewer';

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  created_by: string | null;
  bitrix_user_id: string | null;
};

const HASH_ROUNDS = 10;

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    email: r.email as string,
    full_name: (r.full_name as string) ?? null,
    role: r.role as Role,
    is_active: r.is_active as boolean,
    created_at: (r.created_at as Date).toISOString(),
    updated_at: (r.updated_at as Date).toISOString(),
    last_login_at: r.last_login_at ? (r.last_login_at as Date).toISOString() : null,
    created_by: (r.created_by as string) ?? null,
    bitrix_user_id: (r.bitrix_user_id as string) ?? null,
  };
}

/** Set the Bitrix responsible user id for a dashboard user. */
export async function setBitrixUserId(userId: string, bitrixUserId: string | null): Promise<void> {
  await sql`UPDATE users SET bitrix_user_id = ${bitrixUserId}, updated_at = now() WHERE id = ${userId}`;
}

/**
 * Resolve which Bitrix responsible to assign for an ad account's lead.
 * Finds the (non-admin) user granted that account who has a bitrix_user_id.
 */
export async function resolveBitrixOwner(accountId: string): Promise<string | null> {
  const r = await sql`
    SELECT u.bitrix_user_id
    FROM user_account_access ua
    JOIN users u ON u.id = ua.user_id
    WHERE (ua.account_id = ${accountId} OR ua.account_id = ${'act_' + accountId})
      AND u.bitrix_user_id IS NOT NULL
      AND u.is_active = true
    ORDER BY (u.role = 'admin') ASC
    LIMIT 1
  `;
  return (r.rows[0]?.bitrix_user_id as string) ?? null;
}

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 6) throw new Error('Contraseña mínimo 6 caracteres');
  return bcrypt.hash(plain, HASH_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const r = await sql`
    SELECT id, email, password_hash, full_name, role, is_active, created_at, updated_at, last_login_at, created_by, bitrix_user_id
    FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  if (!r.rows[0]) return null;
  const u = rowToUser(r.rows[0]);
  return { ...u, password_hash: r.rows[0].password_hash as string };
}

export async function findUserById(id: string): Promise<User | null> {
  const r = await sql`
    SELECT id, email, password_hash, full_name, role, is_active, created_at, updated_at, last_login_at, created_by, bitrix_user_id
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;
  return r.rows[0] ? rowToUser(r.rows[0]) : null;
}

export async function listUsers(): Promise<User[]> {
  const r = await sql`
    SELECT id, email, password_hash, full_name, role, is_active, created_at, updated_at, last_login_at, created_by, bitrix_user_id
    FROM users
    ORDER BY created_at DESC
  `;
  return r.rows.map(rowToUser);
}

export async function createUser(params: {
  email: string;
  password: string;
  full_name?: string;
  role?: Role;
  created_by?: string;
}): Promise<User> {
  const hash = await hashPassword(params.password);
  const role: Role = params.role ?? 'operator';
  const existing = await findUserByEmail(params.email);
  if (existing) throw new Error('Email ya registrado');
  const r = await sql`
    INSERT INTO users (email, password_hash, full_name, role, created_by)
    VALUES (${params.email}, ${hash}, ${params.full_name ?? null}, ${role}, ${params.created_by ?? null})
    RETURNING id, email, password_hash, full_name, role, is_active, created_at, updated_at, last_login_at, created_by, bitrix_user_id
  `;
  return rowToUser(r.rows[0]);
}

export async function updateUserRole(userId: string, role: Role): Promise<void> {
  await sql`UPDATE users SET role = ${role}, updated_at = now() WHERE id = ${userId}`;
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  await sql`UPDATE users SET is_active = ${active}, updated_at = now() WHERE id = ${userId}`;
}

export async function changePassword(userId: string, newPlain: string): Promise<void> {
  const hash = await hashPassword(newPlain);
  await sql`UPDATE users SET password_hash = ${hash}, updated_at = now() WHERE id = ${userId}`;
}

export async function touchLastLogin(userId: string): Promise<void> {
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${userId}`;
}

/* ---- Account access ---- */

export type AccountGrant = { account_id: string; account_name: string | null };

export async function getUserAccounts(userId: string): Promise<AccountGrant[]> {
  const r = await sql`
    SELECT account_id, account_name
    FROM user_account_access
    WHERE user_id = ${userId}
    ORDER BY account_name NULLS LAST, account_id
  `;
  return r.rows.map((row) => ({
    account_id: row.account_id as string,
    account_name: (row.account_name as string) ?? null,
  }));
}

export async function grantAccount(userId: string, accountId: string, accountName: string | null, grantedBy: string | null): Promise<void> {
  await sql`
    INSERT INTO user_account_access (user_id, account_id, account_name, granted_by)
    VALUES (${userId}, ${accountId}, ${accountName}, ${grantedBy})
    ON CONFLICT (user_id, account_id) DO UPDATE SET account_name = EXCLUDED.account_name
  `;
}

export async function revokeAccount(userId: string, accountId: string): Promise<void> {
  await sql`DELETE FROM user_account_access WHERE user_id = ${userId} AND account_id = ${accountId}`;
}

export async function setUserAccounts(userId: string, grants: AccountGrant[], grantedBy: string | null): Promise<void> {
  await sql`DELETE FROM user_account_access WHERE user_id = ${userId}`;
  for (const g of grants) {
    await sql`
      INSERT INTO user_account_access (user_id, account_id, account_name, granted_by)
      VALUES (${userId}, ${g.account_id}, ${g.account_name}, ${grantedBy})
    `;
  }
}

/* ---- Audit log ---- */

export async function audit(params: {
  user_id: string | null;
  user_email?: string | null;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  await sql`
    INSERT INTO audit_log (user_id, user_email, action, target_type, target_id, metadata, ip)
    VALUES (
      ${params.user_id},
      ${params.user_email ?? null},
      ${params.action},
      ${params.target_type ?? null},
      ${params.target_id ?? null},
      ${JSON.stringify(params.metadata ?? null)}::jsonb,
      ${params.ip ?? null}
    )
  `;
}
