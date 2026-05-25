import { NextResponse } from 'next/server';
import { metaGet, listAccounts } from '@/lib/meta-api';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

type OpResult = {
  ok: boolean;
  status?: number;
  error_code?: number;
  error_message?: string;
};

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
  ops?: {
    meta: OpResult;
    campaigns: OpResult;
    ads: OpResult;
    insights: OpResult;
  };
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

function parseMetaError(e: unknown): OpResult {
  const msg = e instanceof Error ? e.message : 'Unknown';
  const codeMatch = msg.match(/\(#(\d+)\)/);
  const statusMatch = msg.match(/Meta API (\d+)/);
  return {
    ok: false,
    status: statusMatch ? Number(statusMatch[1]) : undefined,
    error_code: codeMatch ? Number(codeMatch[1]) : undefined,
    error_message: msg.length > 200 ? msg.slice(0, 200) + '…' : msg,
  };
}

async function probeOp(fn: () => Promise<unknown>): Promise<OpResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return parseMetaError(e);
  }
}

async function probeAccount(id: string, name: string): Promise<AccountCheck> {
  const actId = id.startsWith('act_') ? id : `act_${id}`;
  let metaRes: OpResult = { ok: false };
  let row: Record<string, unknown> = {};
  try {
    const r = await metaGet(`/${actId}`, {
      fields: 'name,currency,account_status,disable_reason',
    }, { paginate: false });
    const raw = Array.isArray(r.data) ? r.data[0] : r;
    row = (raw || {}) as Record<string, unknown>;
    metaRes = { ok: true };
  } catch (e) {
    metaRes = parseMetaError(e);
  }

  // Probe the actual operations the dashboard performs.
  // These are the calls that fail with "ads_read / ads_management permission"
  // even when /me/permissions reports them granted, because Meta also checks
  // the SPECIFIC asset access for that endpoint × ad account combo.
  const [campaigns, ads, insights] = await Promise.all([
    probeOp(() => metaGet(`/${actId}/campaigns`, { fields: 'id', limit: 1 })),
    probeOp(() => metaGet(`/${actId}/ads`, { fields: 'id', limit: 1 })),
    probeOp(() => metaGet(`/${actId}/insights`, { fields: 'spend', date_preset: 'last_7d', limit: 1 })),
  ]);

  const ops = { meta: metaRes, campaigns, ads, insights };
  const allOk = metaRes.ok && campaigns.ok && ads.ok && insights.ok;
  const firstFail = !metaRes.ok ? metaRes : !campaigns.ok ? campaigns : !ads.ok ? ads : !insights.ok ? insights : null;

  return {
    account_id: id,
    account_name: (row.name as string) || name,
    currency: row.currency as string | undefined,
    account_status: row.account_status as number | undefined,
    disable_reason: (row.disable_reason as number | string | null) ?? null,
    ok: allOk,
    status: firstFail?.status,
    error_code: firstFail?.error_code,
    error_message: firstFail?.error_message,
    ops,
  };
}

// Run an async fn over items with bounded concurrency to avoid hitting Meta
// BUC rate limits when probing dozens of accounts.
async function withConcurrency<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
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
    // Concurrency cap of 4 keeps simultaneous Meta calls ≤16 (4 ops × 4 accts)
    // and avoids 'User request limit reached' on big account lists.
    accountChecks = await withConcurrency(
      accounts as Array<{ id: string; name: string }>,
      4,
      (a) => probeAccount(a.id, a.name)
    );
  } else if ((accounts as { error?: string }).error) {
    listError = (accounts as { error: string }).error;
  }

  const rateLimited = accountChecks.filter((c) =>
    Object.values(c.ops || {}).some((op) => !op.ok && /request limit reached/i.test(op.error_message || ''))
  ).length;

  const summary = {
    total: accountChecks.length,
    ok: accountChecks.filter((c) => c.ok).length,
    failing: accountChecks.filter((c) => !c.ok).length,
    permission_errors: accountChecks.filter((c) => c.error_code === 200).length,
    rate_limited: rateLimited,
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
