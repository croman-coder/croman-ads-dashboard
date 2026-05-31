import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * TikTok OAuth callback. TikTok redirects here with `auth_code` (or `code`).
 * Exchanges it for a long-lived access_token via the v1.3 token endpoint.
 *
 * STUB BEHAVIOR until app approved:
 *   - If TIKTOK_APP_ID / TIKTOK_SECRET missing → returns guidance, no exchange.
 *   - On success → returns token payload. (Persisting to env/DB is a follow-up;
 *     for now operator copies token into TIKTOK_ACCESS_TOKEN env.)
 *
 * Env: TIKTOK_APP_ID, TIKTOK_SECRET
 */

const TOKEN_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/';

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get('auth_code') || url.searchParams.get('code');
  const appId = process.env.TIKTOK_APP_ID;
  const secret = process.env.TIKTOK_SECRET;

  if (!appId || !secret) {
    return NextResponse.json(
      {
        status: 'pending_setup',
        message: 'TikTok app aún no aprobada. Falta TIKTOK_APP_ID / TIKTOK_SECRET en env.',
        next: 'Cuando TikTok apruebe la app, agregar App ID + Secret a Vercel env y reintentar.',
      },
      { status: 503 }
    );
  }
  if (!code) {
    return NextResponse.json({ error: 'falta auth_code en callback' }, { status: 400 });
  }

  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, secret, auth_code: code, grant_type: 'authorized_code' }),
    });
    const j = await r.json();
    if (j.code !== 0) {
      return NextResponse.json({ error: `TikTok ${j.code}: ${j.message}` }, { status: 400 });
    }
    const data = j.data || {};
    // access_token + advertiser_ids returned. Operator copies into env for now.
    return NextResponse.json({
      status: 'connected',
      access_token_preview: data.access_token ? `${String(data.access_token).slice(0, 8)}…` : null,
      advertiser_ids: data.advertiser_ids || [],
      scope: data.scope,
      note: 'Copiar access_token completo a TIKTOK_ACCESS_TOKEN en Vercel env. (Persistencia automática = follow-up.)',
      _full: data, // full payload so operator can grab the token once
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
