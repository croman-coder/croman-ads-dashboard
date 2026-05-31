/**
 * Platform registry. Resolve adapter by id. Dashboard imports from here.
 */
import type { PlatformAdapter, PlatformId } from './types';
import { metaAdapter } from './meta';
import { tiktokAdapter } from './tiktok';

const ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  meta: metaAdapter,
  tiktok: tiktokAdapter,
  // google: added once Developer Token approved
  google: metaAdapter, // placeholder — never configured, isConfigured()=false guards it
};

export function getAdapter(id: PlatformId): PlatformAdapter {
  return ADAPTERS[id] || metaAdapter;
}

/** All adapters with live config status — for integrations page. */
export function adapterStatus(): Array<{ id: PlatformId; label: string; configured: boolean }> {
  return [
    { id: 'meta', label: 'Meta', configured: metaAdapter.isConfigured() },
    { id: 'tiktok', label: 'TikTok Ads', configured: tiktokAdapter.isConfigured() },
    { id: 'google', label: 'Google Ads', configured: false },
  ];
}

export type { PlatformAdapter, PlatformId } from './types';
export { NotImplemented } from './types';
