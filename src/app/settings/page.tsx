'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PasswordInput } from '@/components/PasswordInput';
import {
  User as UserIcon,
  Shield,
  KeyRound,
  Mail,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  Eye,
  Activity,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

type Role = 'admin' | 'operator' | 'viewer';
type DbUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  bitrix_user_id: string | null;
};
type Account = { id: string; name: string; currency: string };
type BitrixUser = { id: string; name: string; email?: string };
type AccountGrant = { account_id: string; account_name: string | null };
type Profile = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: Role;
  accounts: AccountGrant[];
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ROLE_ICON = { admin: ShieldCheck, operator: UserIcon, viewer: Eye } as const;

export default function SettingsPage() {
  const { account, setAccount } = useAccount();
  const { toasts, push, dismiss } = useToasts();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [tab, setTab] = useState<'profile' | 'users' | 'meta'>('profile');

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const [inv, setInv] = useState({ email: '', password: '', full_name: '', role: 'operator' as Role });
  const [inviting, setInviting] = useState(false);

  const [editUser, setEditUser] = useState<DbUser | null>(null);
  const [grantsUser, setGrantsUser] = useState<DbUser | null>(null);
  const [bitrixUsers, setBitrixUsers] = useState<BitrixUser[]>([]);
  const [confirm, setConfirm] = useState<null | { title: string; msg: string; action: () => Promise<void>; destructive?: boolean }>(null);

  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((j) => {
      if (!j.authenticated) return;
      setProfile({
        user_id: j.user_id,
        email: j.email,
        full_name: j.full_name,
        role: j.role,
        accounts: j.accounts || [],
      });
    });
    fetch('/api/accounts').then((r) => r.json()).then((j) => setAccounts(j.data || []));
  }, []);

  const loadUsers = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoadingUsers(true);
    try {
      const r = await fetch('/api/admin/users');
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setUsers(j.users || []);
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, [profile, push]);

  useEffect(() => {
    if (tab === 'users') {
      loadUsers();
      fetch('/api/admin/bitrix-users').then((r) => r.json()).then((j) => setBitrixUsers(j.users || [])).catch(() => {});
    }
  }, [tab, loadUsers]);

  async function mapBitrix(userId: string, bitrixId: string) {
    try {
      const r = await fetch(`/api/admin/users/${userId}/bitrix`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bitrix_user_id: bitrixId || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Error');
      push('Vendedor Bitrix asignado', 'success');
      loadUsers();
    } catch (e) { push(e instanceof Error ? e.message : 'Error', 'error'); }
  }

  async function changePasswordFn(e: React.FormEvent) {
    e.preventDefault();
    setPwdSaving(true);
    try {
      const r = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      push('Contraseña actualizada', 'success');
      setCurrentPwd('');
      setNewPwd('');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setPwdSaving(false);
    }
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();
    if (!inv.email || !inv.password) {
      push('Email y contraseña requeridos', 'error');
      return;
    }
    setInviting(true);
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inv),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      push(`Usuario creado: ${j.user.email}`, 'success');
      setInv({ email: '', password: '', full_name: '', role: 'operator' });
      loadUsers();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setInviting(false);
    }
  }

  async function patchUser(id: string, patch: Record<string, unknown>) {
    try {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      push('Actualizado', 'success');
      loadUsers();
      setEditUser(null);
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    }
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[1300px] mx-auto w-full space-y-6">
          <header className="fade-in">
            <p className="eyebrow mb-1">Configuración</p>
            <h1 className="display text-5xl">Ajustes</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-2">Perfil, contraseña y gestión de usuarios.</p>
          </header>

          <div className="border-b border-[var(--hairline)] flex items-center gap-1">
            <TabBtn active={tab === 'profile'} onClick={() => setTab('profile')}>Mi perfil</TabBtn>
            {isAdmin && <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>Usuarios</TabBtn>}
            {isAdmin && <TabBtn active={tab === 'meta'} onClick={() => setTab('meta')}>Meta API</TabBtn>}
          </div>

          {tab === 'profile' && profile && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger">
              <section className="card p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[oklch(0.52_0.22_278)] to-[oklch(0.62_0.26_330)] flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {(profile.full_name || profile.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="display text-2xl">{profile.full_name || 'Sin nombre'}</h2>
                    <p className="text-sm text-[var(--fg-muted)] flex items-center gap-1.5 mt-1"><Mail size={12} /> {profile.email}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <RolePill role={profile.role} />
                      <span className="eyebrow">{profile.accounts.length} cuentas</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-[var(--hairline)]">
                  <div className="eyebrow mb-2 flex items-center gap-1.5"><Shield size={11} /> Cuentas con acceso</div>
                  {profile.accounts.length === 0 ? (
                    <p className="text-[12px] text-[var(--fg-muted)]">{isAdmin ? 'Admin tiene acceso global a todas las cuentas Meta.' : 'Sin cuentas asignadas. Pedile a un admin que te otorgue acceso.'}</p>
                  ) : (
                    <ul className="text-[12px] text-[var(--fg-soft)] space-y-1 font-[family-name:var(--font-mono)]">
                      {profile.accounts.map((a) => (
                        <li key={a.account_id}>{a.account_name || a.account_id}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className="card p-6">
                <h2 className="display text-2xl mb-1">Cambiar contraseña</h2>
                <p className="text-[12px] text-[var(--fg-muted)] mb-5">Mínimo 8 caracteres. Sesión se mantiene activa.</p>
                <form onSubmit={changePasswordFn} className="space-y-4">
                  <Field label="Contraseña actual">
                    <PasswordInput value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} autoComplete="current-password" required inputClassName="input" />
                  </Field>
                  <Field label="Nueva contraseña">
                    <PasswordInput value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" minLength={8} required inputClassName="input" />
                  </Field>
                  <button type="submit" disabled={pwdSaving || !currentPwd || newPwd.length < 8} className="btn-primary px-4 py-2 flex items-center gap-2 text-sm">
                    {pwdSaving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    Actualizar contraseña
                  </button>
                </form>
              </section>
            </div>
          )}

          {tab === 'meta' && isAdmin && <MetaDiagnostic push={push} />}

          {tab === 'users' && isAdmin && (
            <div className="space-y-5 stagger">
              <section className="card p-6">
                <h2 className="display text-2xl mb-1">Invitar usuario</h2>
                <p className="text-[12px] text-[var(--fg-muted)] mb-5">Creá una cuenta con email + contraseña inicial. El usuario podrá cambiarla después.</p>
                <form onSubmit={inviteUser} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <Field label="Email">
                    <input type="email" required value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} className="input" />
                  </Field>
                  <Field label="Nombre completo">
                    <input value={inv.full_name} onChange={(e) => setInv({ ...inv, full_name: e.target.value })} className="input" />
                  </Field>
                  <Field label="Rol">
                    <select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as Role })} className="input">
                      <option value="admin">Admin</option>
                      <option value="operator">Operador</option>
                      <option value="viewer">Visualizador</option>
                    </select>
                  </Field>
                  <Field label="Contraseña inicial (≥8)">
                    <PasswordInput minLength={8} required value={inv.password} onChange={(e) => setInv({ ...inv, password: e.target.value })} inputClassName="input" />
                  </Field>
                  <div className="md:col-span-4 flex justify-end">
                    <button type="submit" disabled={inviting} className="btn-gradient px-4 py-2 flex items-center gap-2 text-sm">
                      {inviting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Crear usuario
                    </button>
                  </div>
                </form>
              </section>

              <section className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--hairline)] flex items-center justify-between">
                  <h2 className="display text-2xl">Usuarios ({users.length})</h2>
                  {loadingUsers && <Loader2 size={14} className="animate-spin text-[var(--fg-muted)]" />}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-semibold border-b border-[var(--hairline)]">
                      <th className="px-6 py-3 text-left">Usuario</th>
                      <th className="px-4 py-3 text-left">Rol</th>
                      <th className="px-4 py-3 text-left">Vendedor Bitrix</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Último login</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-[var(--hairline)] hover:bg-[var(--surface)]">
                        <td className="px-6 py-3">
                          <div className="text-[var(--fg)] font-medium">{u.full_name || u.email}</div>
                          <div className="text-[11px] text-[var(--fg-muted)]">{u.email}</div>
                        </td>
                        <td className="px-4 py-3"><RolePill role={u.role} /></td>
                        <td className="px-4 py-3">
                          <select
                            value={u.bitrix_user_id || ''}
                            onChange={(e) => mapBitrix(u.id, e.target.value)}
                            className="bg-[var(--bg-elevated-2)] border border-[var(--border)] rounded px-2 py-1 text-[12px] text-[var(--fg)] max-w-[160px] focus:outline-none focus:border-[var(--accent)]"
                          >
                            <option value="">— sin asignar —</option>
                            {bitrixUsers.map((bu) => (
                              <option key={bu.id} value={bu.id}>{bu.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--success)]"><CheckCircle2 size={12} /> Activo</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]"><XCircle size={12} /> Inactivo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[var(--fg-muted)] font-[family-name:var(--font-mono)]">{fmtDate(u.last_login_at)}</td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setGrantsUser(u)} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--fg-soft)] hover:text-[var(--accent)] transition-colors" title="Cuentas">
                              <Shield size={13} />
                            </button>
                            <button onClick={() => setEditUser(u)} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--fg-soft)] hover:text-[var(--fg)] transition-colors" title="Editar">
                              <Pencil size={13} />
                            </button>
                            {u.id !== profile?.user_id && (
                              <button
                                onClick={() => setConfirm({
                                  title: u.is_active ? 'Desactivar usuario' : 'Reactivar usuario',
                                  msg: `${u.email}`,
                                  destructive: u.is_active,
                                  action: () => patchUser(u.id, { is_active: !u.is_active }),
                                })}
                                className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--danger)] transition-colors"
                                title={u.is_active ? 'Desactivar' : 'Reactivar'}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}
        </main>
      </div>

      {editUser && (
        <EditUserModal user={editUser} onCancel={() => setEditUser(null)} onSave={(patch) => patchUser(editUser.id, patch)} />
      )}
      {grantsUser && (
        <GrantsModal user={grantsUser} accounts={accounts} push={push} onClose={() => { setGrantsUser(null); loadUsers(); }} />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.msg || ''}
        destructive={confirm?.destructive}
        onConfirm={async () => { try { await confirm!.action(); } finally { setConfirm(null); } }}
        onCancel={() => setConfirm(null)}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <style jsx global>{`
        .input {
          width: 100%;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 8px 12px;
          font-size: 13px;
          color: var(--fg);
          box-shadow: 0 1px 2px rgba(10, 10, 12, 0.04);
        }
        .input:focus { outline: none; border-color: var(--accent); }
      `}</style>
    </div>
  );
}

type OpResult = { ok: boolean; status?: number; error_code?: number; error_message?: string };
type DiagAccount = {
  account_id: string;
  account_name: string;
  currency?: string;
  ok: boolean;
  status?: number;
  error_code?: number;
  error_subcode?: number;
  error_message?: string;
  account_status?: number;
  ops?: { meta: OpResult; campaigns: OpResult; ads: OpResult; insights: OpResult };
};

type DiagResponse = {
  token: { token_ok: boolean; user_id?: string; app_id?: string; expires_at?: number | 'never'; scopes?: string[]; error?: string };
  permissions: { granted?: string[]; declined?: string[]; expired?: string[]; required_present?: { ads_read: boolean; ads_management: boolean; business_management: boolean }; error?: string };
  list_accounts_error?: string;
  accounts: DiagAccount[];
  summary: { total: number; ok: number; failing: number; permission_errors: number; rate_limited?: number };
  api_version: string;
  fetched_at: string;
};

const REQUIRED_SCOPES = ['ads_management', 'ads_read', 'business_management', 'read_insights', 'pages_show_list', 'leads_retrieval'];

function MetaDiagnostic({ push }: { push: (m: string, t: 'success' | 'error') => void }) {
  const [data, setData] = useState<DiagResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/diag/meta');
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j as DiagResponse);
      const failing = j.summary?.failing || 0;
      push(failing === 0 ? `OK: ${j.summary.ok} cuentas accesibles` : `${failing} cuentas fallan`, failing === 0 ? 'success' : 'error');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="space-y-5 stagger">
      <section className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="display text-2xl mb-1">Diagnóstico Meta API</h2>
            <p className="text-[12px] text-[var(--fg-muted)]">Pinguea cada cuenta publicitaria y muestra qué token + permisos faltan.</p>
          </div>
          <button onClick={run} disabled={loading} className="btn-primary px-4 py-2 flex items-center gap-2 text-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Volver a chequear
          </button>
        </div>
      </section>

      {error && (
        <div className="card border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)] px-4 py-3 text-sm">{error}</div>
      )}

      {data && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger">
            <DiagTile label="TOTAL CUENTAS" value={String(data.summary.total)} tone="info" />
            <DiagTile label="OK" value={String(data.summary.ok)} tone="success" />
            <DiagTile label="CON ERROR" value={String(data.summary.failing)} tone={data.summary.failing > 0 ? 'danger' : 'success'} />
            <DiagTile label="PERMISO (#200)" value={String(data.summary.permission_errors)} tone={data.summary.permission_errors > 0 ? 'warning' : 'success'} />
            <DiagTile label="RATE LIMIT" value={String(data.summary.rate_limited || 0)} tone={(data.summary.rate_limited || 0) > 0 ? 'warning' : 'success'} />
          </div>

          {/* Token + permissions */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-6">
              <div className="eyebrow mb-3 flex items-center gap-1.5"><KeyRound size={11} /> Token</div>
              <div className="space-y-2 text-[12.5px]">
                <KV label="Válido" value={data.token.token_ok ? <span className="text-[var(--success)] flex items-center gap-1.5"><CheckCircle2 size={12}/> sí</span> : <span className="text-[var(--danger)] flex items-center gap-1.5"><XCircle size={12}/> no</span>} />
                <KV label="User ID" value={<span className="font-[family-name:var(--font-mono)]">{data.token.user_id || '—'}</span>} />
                <KV label="App ID" value={<span className="font-[family-name:var(--font-mono)]">{data.token.app_id || '—'}</span>} />
                <KV label="Expira" value={
                  data.token.expires_at === 'never' ? <span className="text-[var(--success)]">nunca</span> :
                  typeof data.token.expires_at === 'number' ? new Date(data.token.expires_at * 1000).toLocaleDateString('es-PY') : '—'
                } />
                <KV label="Versión API" value={<span className="font-[family-name:var(--font-mono)]">{data.api_version}</span>} />
                {data.token.error && <KV label="Error" value={<span className="text-[var(--danger)]">{data.token.error}</span>} />}
              </div>
            </div>

            <div className="card p-6">
              <div className="eyebrow mb-3 flex items-center gap-1.5"><Shield size={11} /> Permisos requeridos</div>
              {data.permissions.error ? (
                <p className="text-[12px] text-[var(--danger)]">{data.permissions.error}</p>
              ) : (
                <ul className="space-y-1.5 text-[12px]">
                  {REQUIRED_SCOPES.map((s) => {
                    const granted = data.permissions.granted?.includes(s);
                    return (
                      <li key={s} className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--hairline)] last:border-0">
                        <span className="font-[family-name:var(--font-mono)]">{s}</span>
                        {granted ? (
                          <span className="inline-flex items-center gap-1 text-[var(--success)] text-[11px]"><CheckCircle2 size={11}/> granted</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[var(--danger)] text-[11px]"><XCircle size={11}/> falta</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Per-account table */}
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--hairline)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-[var(--accent)]" />
                <h2 className="display text-2xl">Cuentas publicitarias</h2>
              </div>
              <span className="text-[11px] text-[var(--fg-muted)] font-[family-name:var(--font-mono)]">
                {new Date(data.fetched_at).toLocaleTimeString('es-PY')}
              </span>
            </div>
            {data.list_accounts_error ? (
              <div className="p-6 text-[12px] text-[var(--danger)]">No se pudo listar cuentas: {data.list_accounts_error}</div>
            ) : data.accounts.length === 0 ? (
              <div className="p-6 text-[12px] text-[var(--fg-muted)]">Sin cuentas visibles para este token.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-semibold border-b border-[var(--hairline)]">
                    <th className="px-6 py-3 text-left">Cuenta</th>
                    <th className="px-3 py-3 text-center" title="GET /act_X (metadata)">META</th>
                    <th className="px-3 py-3 text-center" title="GET /act_X/campaigns">CAMP.</th>
                    <th className="px-3 py-3 text-center" title="GET /act_X/ads">ADS</th>
                    <th className="px-3 py-3 text-center" title="GET /act_X/insights">INSIGHTS</th>
                    <th className="px-4 py-3 text-left">Detalle error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a) => (
                    <tr key={a.account_id} className="border-t border-[var(--hairline)] hover:bg-[var(--surface)] align-top">
                      <td className="px-6 py-3">
                        <div className="text-[var(--fg)] font-medium text-[13px]">{a.account_name}</div>
                        <div className="text-[10px] text-[var(--fg-faint)] font-[family-name:var(--font-mono)]">{a.account_id} · {a.currency || '—'}</div>
                      </td>
                      <td className="px-3 py-3 text-center"><OpDot op={a.ops?.meta} /></td>
                      <td className="px-3 py-3 text-center"><OpDot op={a.ops?.campaigns} /></td>
                      <td className="px-3 py-3 text-center"><OpDot op={a.ops?.ads} /></td>
                      <td className="px-3 py-3 text-center"><OpDot op={a.ops?.insights} /></td>
                      <td className="px-4 py-3 text-[11px] text-[var(--fg-muted)] max-w-md">
                        {a.ok ? (
                          <span className="text-[var(--success)]">Todo OK</span>
                        ) : (
                          <div className="space-y-1">
                            {a.ops?.campaigns && !a.ops.campaigns.ok && (
                              <div><span className="font-semibold text-[var(--danger)]">campaigns</span>: {a.ops.campaigns.error_message}</div>
                            )}
                            {a.ops?.ads && !a.ops.ads.ok && (
                              <div><span className="font-semibold text-[var(--danger)]">ads</span>: {a.ops.ads.error_message}</div>
                            )}
                            {a.ops?.insights && !a.ops.insights.ok && (
                              <div><span className="font-semibold text-[var(--danger)]">insights</span>: {a.ops.insights.error_message}</div>
                            )}
                            {a.ops?.meta && !a.ops.meta.ok && (
                              <div><span className="font-semibold text-[var(--danger)]">meta</span>: {a.ops.meta.error_message}</div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Rate limit notice */}
          {(data.summary.rate_limited || 0) > 0 && (
            <section className="card p-6 border-[var(--warning)]/30 bg-[var(--warning)]/10">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-[var(--warning)] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-[var(--fg)] font-semibold mb-1">{data.summary.rate_limited} cuentas con rate limit</h3>
                  <p className="text-[12.5px] text-[var(--fg-soft)] leading-relaxed">
                    <span className="font-semibold">No es problema de permisos.</span> Meta limita requests por hora a nivel app + business use case (BUC).
                    Esperar 15–60min y volver a chequear. Si pasa siempre con muchas cuentas:
                  </p>
                  <ul className="text-[12px] text-[var(--fg-muted)] mt-2 list-disc pl-5 space-y-0.5">
                    <li>Considerar mover a Tier de App Marketing API (App Review)</li>
                    <li>Reducir frecuencia de polling en dashboard</li>
                    <li>Usar Insights API batch en lugar de calls individuales</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* How-to fix card */}
          {data.summary.permission_errors > 0 && (
            <section className="card p-6 border-[var(--warning)]/30 bg-[var(--warning)]/10">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-[var(--warning)] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-[var(--fg)] font-semibold mb-2">Cómo arreglar errores (#200)</h3>
                  <ol className="text-[12.5px] text-[var(--fg-soft)] space-y-1.5 list-decimal pl-5">
                    <li>Business Settings → <span className="font-medium">Cuentas → Cuentas publicitarias</span></li>
                    <li>Click cuenta que falla → tab <span className="font-medium">Personas asignadas</span></li>
                    <li>Botón <span className="font-medium">Agregar personas</span> → buscar <code className="font-[family-name:var(--font-mono)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">VALEN_ADS</code></li>
                    <li>Permiso: <span className="font-medium">Administrar campañas</span> (no solo Ver)</li>
                    <li>Guardar → click <span className="font-medium">Volver a chequear</span> arriba</li>
                  </ol>
                  <p className="text-[11px] text-[var(--fg-muted)] mt-3">
                    Si todas las cuentas tiran (#200): revocar y regenerar token de VALEN_ADS en Usuarios del sistema, después actualizar <code className="font-[family-name:var(--font-mono)]">META_ACCESS_TOKEN</code> en Vercel.
                  </p>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function OpDot({ op }: { op?: OpResult }) {
  if (!op) return <span className="text-[var(--fg-faint)]">—</span>;
  if (op.ok) return <CheckCircle2 size={14} className="text-[var(--success)] inline" />;
  const label = op.error_code === 200 ? '403' : (op.error_code ?? op.status ?? '!');
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--danger)]" title={op.error_message}>
      <XCircle size={12} /> {label}
    </span>
  );
}

function DiagTile({ label, value, tone }: { label: string; value: string; tone: 'success' | 'danger' | 'warning' | 'info' }) {
  const cls =
    tone === 'success' ? 'text-[var(--success)] bg-lime-wash' :
    tone === 'danger' ? 'text-[var(--danger)] bg-coral-wash' :
    tone === 'warning' ? 'text-[var(--warning)] bg-amber-wash' :
    'text-[var(--accent)] bg-indigo-wash';
  return (
    <div className={`card p-4 ${cls}`}>
      <div className="eyebrow mb-2 text-[var(--fg-muted)]">{label}</div>
      <div className="numeric text-[28px] font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--hairline)] last:border-0">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className="text-[var(--fg)]">{value}</span>
    </div>
  );
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-[12px] uppercase tracking-[0.12em] font-semibold border-b-2 transition-colors -mb-px ${
        active ? 'border-[var(--accent)] text-[var(--fg)]' : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-soft)]'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="eyebrow mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function RolePill({ role }: { role: Role }) {
  const Icon = ROLE_ICON[role];
  const cls =
    role === 'admin'
      ? 'border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]'
      : role === 'operator'
      ? 'border-[oklch(0.78_0.18_130_/_0.4)] bg-[oklch(0.78_0.18_130_/_0.10)] text-[var(--success)]'
      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)]';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-bold border rounded ${cls}`}>
      <Icon size={10} />
      {role}
    </span>
  );
}

function EditUserModal({ user, onCancel, onSave }: { user: DbUser; onCancel: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [newPwd, setNewPwd] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="card max-w-md w-full mx-4 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="display text-2xl mb-1">Editar {user.email}</h3>
        <p className="text-[11px] text-[var(--fg-muted)] mb-5">Cambiá rol o restablecé contraseña.</p>

        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            <option value="admin">Admin</option>
            <option value="operator">Operador</option>
            <option value="viewer">Visualizador</option>
          </select>
        </Field>

        <div className="mt-4">
          <Field label="Nueva contraseña (opcional, ≥8)">
            <PasswordInput value={newPwd} onChange={(e) => setNewPwd(e.target.value)} inputClassName="input" />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="btn-ghost px-4 py-2">Cancelar</button>
          <button
            onClick={() => {
              const patch: Record<string, unknown> = {};
              if (role !== user.role) patch.role = role;
              if (newPwd.length >= 8) patch.password = newPwd;
              if (Object.keys(patch).length === 0) { onCancel(); return; }
              onSave(patch);
            }}
            className="btn-primary px-4 py-2"
          >Guardar</button>
        </div>
      </div>
    </div>
  );
}

function GrantsModal({ user, accounts, push, onClose }: { user: DbUser; accounts: Account[]; push: (m: string, t: 'success' | 'error') => void; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${user.id}/accounts`)
      .then((r) => r.json())
      .then((j) => {
        const ids = ((j.accounts || []) as AccountGrant[]).map((g) => g.account_id);
        setSelected(new Set(ids));
      })
      .finally(() => setLoading(false));
  }, [user.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const grants = accounts.filter((a) => selected.has(a.id)).map((a) => ({ account_id: a.id, account_name: a.name }));
      const r = await fetch(`/api/admin/users/${user.id}/accounts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: grants }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      push(`Acceso actualizado: ${grants.length} cuentas`, 'success');
      onClose();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-w-lg w-full mx-4 p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="display text-2xl mb-1">Cuentas para {user.email}</h3>
        <p className="text-[12px] text-[var(--fg-muted)] mb-5">{user.role === 'admin' ? 'Admin ve TODAS las cuentas siempre — esta lista es ignorada.' : `Seleccioná las cuentas Meta que ${user.email} podrá ver y operar.`}</p>

        {loading ? (
          <div className="py-12 text-center text-[var(--fg-muted)]"><Loader2 size={20} className="animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto border border-[var(--hairline)] rounded p-2">
            {accounts.length === 0 ? (
              <p className="p-4 text-[12px] text-[var(--fg-muted)] text-center">Sin cuentas Meta disponibles</p>
            ) : (
              accounts.map((a) => (
                <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-[var(--surface)] cursor-pointer">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="accent-[var(--accent)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[var(--fg)] truncate">{a.name}</div>
                    <div className="text-[10px] text-[var(--fg-faint)] font-[family-name:var(--font-mono)]">{a.id} · {a.currency}</div>
                  </div>
                </label>
              ))
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <span className="text-[11px] text-[var(--fg-muted)]">{selected.size} seleccionadas</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-2">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary px-4 py-2 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Guardar accesos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
