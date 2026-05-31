import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { listAccounts } from '@/lib/meta-api';
import { adapterStatus } from '@/lib/platforms';

export const dynamic = 'force-dynamic';

/** Connection status for ad platforms via adapter registry + live Meta probe. */
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const status = adapterStatus();
  const metaCfg = status.find((s) => s.id === 'meta');
  const tiktokCfg = status.find((s) => s.id === 'tiktok');

  // Live Meta probe for account count
  let metaConnected = false;
  let accountCount = 0;
  let metaError: string | undefined;
  if (metaCfg?.configured) {
    try {
      const accts = (await listAccounts()) as Array<{ id: string }>;
      accountCount = accts.length;
      metaConnected = accountCount > 0;
    } catch (e) {
      metaError = e instanceof Error ? e.message : 'Unknown';
    }
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
      {
        id: 'tiktok',
        name: 'TikTok Ads',
        channels: ['tiktok'],
        connected: !!tiktokCfg?.configured,
        accounts: 0,
        // configured token but not yet verified = connected; else en revisión
        status: tiktokCfg?.configured ? 'connected' : 'review',
      },
      { id: 'google', name: 'Google Ads', channels: ['youtube', 'google'], connected: false, accounts: 0, status: 'soon' },
    ],
  });
}
