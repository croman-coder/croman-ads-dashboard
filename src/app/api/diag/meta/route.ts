import { NextResponse } from 'next/server';
import { metaGet, listAccounts } from '@/lib/meta-api';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

type AccountCheck = {
  account_id: string;
  account_name: string;
  currency?: string;
  ok: boolean;
  status?: number;
  error_code?: number;
  error_subcode?: number;
  error_message?: string;
  account_status?: number;
  disable_reason?: number | string | null;
};

type PermsResult = {
  granted: string[];
  declined: string[];
  expired: string[];
  required_present: { ads_read: boolean; ads_management: boolean; business_management: boolean };
};

async function probeToken(): Promise<{ token_ok: boolean; user_id?: string; app_id?: string; expires_at?: number | 'never'; scopes?: string[]; error?: string }> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return { token_ok: false, error: 'META_ACCESS_TOKEN no configurado' };
  try {
    // debug_token uses the same token as app token (works for short tests)
    const url = `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j.error) return { token_ok: false, error: j.error.message };
    const data = j.data || {};
    return {
      token_ok: !!data.is_valid,
      user_id: data.user_id,
      app_id: data.app_id,
      expires_at: data.expires_at === 0 ? 'never' : data.expires_at,
      scopes: data.scopes || [],
    };
  } catch (e) {
    return { token_ok: false, error: e instanceof Error ? e.message : 'Unknown' };
  }
}

async function probePermissions(): Promise<PermsResult | { error: string }> {
  try {
    const r = await metaGet('/me/permissions', {});
    const perms = (r.data || []) as Array<{ permission: string; status: string }>;
    const granted = perms.filter((p) => p.status === 'granted').map((p) => p.permission);
    const declined = perms.filter((p) => p.status === 'declined').map((p) => p.permission);
    const expired = perms.filter((p) => p.status === 'expired').map((p) => p.permission);
    return {
      granted,
      declined,
      expired,
      required_present: {
        ads_read: granted.includes('ads_read'),
        ads_management: granted.includes('ads_management'),
        business_management: granted.includes('business_management'),
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown' };
  }
}

async function probeAccount(id: string, name: string): Promise<AccountCheck> {
  const actId = id.startsWith('act_') ? id : `act_${id}`;
  try {
    const r = await metaGet(`/${actId}`, {
      fields: 'name,currency,account_status,disable_reason',
    }, { paginate: false });
    const raw = Array.isArray(r.data) ? r.data[0] : r;
    const row = (raw || {}) as Record<string, unknown>;
    return {
      account_id: id,
      account_name: (row.name as string) || name,
      currency: row.currency as string | undefined,
      ok: true,
      account_status: row.account_status as number | undefined,
      disable_reason: (row.disable_reason as number | string | null) ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    // Parse Meta error format: "Meta API XXX: (#code) message"
    const codeMatch = msg.match(/\(#(\d+)\)/);
    const statusMatch = msg.match(/Meta API (\d+)/);
    return {
      account_id: id,
      account_name: name,
      ok: false,
      status: statusMatch ? Number(statusMatch[1]) : undefined,
      error_code: codeMatch ? Number(codeMatch[1]) : undefined,
      error_message: msg.length > 240 ? msg.slice(0, 240) + '…' : msg,
    };
  }
}

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [tokenInfo, perms, accounts] = await Promise.all([
    probeToken(),
    probePermissions(),
    listAccounts().catch((e) => ({ error: e instanceof Error ? e.message : 'Unknown' })),
  ]);

  let accountChecks: AccountCheck[] = [];
  let listError: string | undefined;
  if (Array.isArray(accounts)) {
    accountChecks = await Promise.all(
      (accounts as Array<{ id: string; name: string }>).map((a) => probeAccount(a.id, a.name))
    );
  } else if ((accounts as { error?: string }).error) {
    listError = (accounts as { error: string }).error;
  }

  const summary = {
    total: accountChecks.length,
    ok: accountChecks.filter((c) => c.ok).length,
    failing: accountChecks.filter((c) => !c.ok).length,
    permission_errors: accountChecks.filter((c) => c.error_code === 200).length,
  };

  return NextResponse.json({
    token: tokenInfo,
    permissions: perms,
    list_accounts_error: listError,
    accounts: accountChecks,
    summary,
    api_version: process.env.META_API_VERSION || 'v21.0',
    fetched_at: new Date().toISOString(),
  });
}
