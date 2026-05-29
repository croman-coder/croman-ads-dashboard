import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { requireSession } from '@/lib/api-auth';
import { audit } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ account: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { account } = await ctx.params;
  const r = await sql`SELECT * FROM account_profiles WHERE account_id = ${account} LIMIT 1`;
  return NextResponse.json({ profile: r.rows[0] || null });
}

export async function PUT(req: Request, ctx: { params: Promise<{ account: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { account } = await ctx.params;
  const b = await req.json();
  const {
    account_name = null,
    business_desc = null,
    products = null,
    audience = null,
    tone = null,
    geo = null,
    onboarding_step = null,
  } = b as Record<string, string | number | null>;

  await sql`
    INSERT INTO account_profiles (account_id, account_name, business_desc, products, audience, tone, geo, onboarding_step, updated_by, updated_at)
    VALUES (${account}, ${account_name}, ${business_desc}, ${products}, ${audience}, ${tone}, ${geo}, ${onboarding_step ?? 1}, ${session.userId}, now())
    ON CONFLICT (account_id) DO UPDATE SET
      account_name = COALESCE(EXCLUDED.account_name, account_profiles.account_name),
      business_desc = COALESCE(EXCLUDED.business_desc, account_profiles.business_desc),
      products = COALESCE(EXCLUDED.products, account_profiles.products),
      audience = COALESCE(EXCLUDED.audience, account_profiles.audience),
      tone = COALESCE(EXCLUDED.tone, account_profiles.tone),
      geo = COALESCE(EXCLUDED.geo, account_profiles.geo),
      onboarding_step = COALESCE(EXCLUDED.onboarding_step, account_profiles.onboarding_step),
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  `;
  await audit({ user_id: session.userId, user_email: session.email, action: 'business_profile.save', target_type: 'account', target_id: account });
  return NextResponse.json({ ok: true });
}
