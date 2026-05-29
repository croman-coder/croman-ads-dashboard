import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { listAccounts } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';

/** Connection status for ad platforms. Meta is live (token present + accounts). */
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let metaConnected = false;
  let accountCount = 0;
  let metaError: string | undefined;
  try {
    const accts = (await listAccounts()) as Array<{ id: string }>;
    accountCount = accts.length;
    metaConnected = accountCount > 0;
  } catch (e) {
    metaError = e instanceof Error ? e.message : 'Unknown';
  }

  return NextResponse.json({
    integrations: [
      {
        id: 'meta',
        name: 'Meta',
        channels: ['instagram', 'whatsapp', 'facebook'],
        connected: metaConnected,
        accounts: accountCount,
        status: metaConnected ? 'connected' : 'error',
        error: metaError,
      },
      { id: 'tiktok', name: 'TikTok Ads', channels: ['tiktok'], connected: false, accounts: 0, status: 'soon' },
      { id: 'google', name: 'Google Ads', channels: ['youtube', 'google'], connected: false, accounts: 0, status: 'soon' },
    ],
  });
}
