'use client';

import { useEffect, useState } from 'react';
import { Trophy, Video, ImageOff } from 'lucide-react';
import { fmtUSD, fmtInt } from '@/lib/utils';

type Row = {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  leads: number;
};

type Ad = {
  id: string;
  name: string;
  campaign_id: string;
  effective_status: string;
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    video_id?: string;
    object_story_spec?: {
      link_data?: { picture?: string };
      video_data?: { image_url?: string; video_id?: string };
    };
  };
};

function previewUrl(ad: Ad): string | null {
  const c = ad.creative;
  if (!c) return null;
  return (
    c.thumbnail_url ||
    c.image_url ||
    c.object_story_spec?.link_data?.picture ||
    c.object_story_spec?.video_data?.image_url ||
    null
  );
}

function isVideo(ad: Ad): boolean {
  return !!(ad.creative?.video_id || ad.creative?.object_story_spec?.video_data?.video_id);
}

export function TopPerformer({ rows, accountId }: { rows: Row[]; accountId: string }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetch(`/api/ads?account_id=${accountId}`)
      .then((r) => r.json())
      .then((j) => setAds(j.data || []))
      .catch(() => setAds([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  // Best campaign by leads, then by CPL
  const withCpl = rows
    .filter((r) => r.leads > 0)
    .map((r) => ({ ...r, cpl: Number(r.spend) / r.leads }))
    .sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      return a.cpl - b.cpl;
    });

  const winner = withCpl[0];
  const winnerAd = winner ? ads.find((a) => a.campaign_id === winner.campaign_id && a.effective_status === 'ACTIVE') : null;
  const url = winnerAd ? previewUrl(winnerAd) : null;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Trophy size={14} className="text-[var(--data)]" />
        <h2 className="display text-2xl text-[var(--fg)]">Top performer</h2>
      </div>

      {!winner ? (
        <div className="px-5 pb-6 text-sm text-[var(--fg-muted)]">
          {loading ? 'Cargando…' : 'Sin campañas con leads en el rango.'}
        </div>
      ) : (
        <>
          {/* Preview */}
          <div className="relative aspect-[4/3] bg-[var(--bg-deep)] border-y border-[var(--hairline)] overflow-hidden">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={winner.campaign_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[var(--fg-faint)]">
                <ImageOff size={28} />
                <span className="text-[10px] uppercase tracking-[0.14em]">Sin preview</span>
              </div>
            )}
            {winnerAd && isVideo(winnerAd) && (
              <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] backdrop-blur-sm">
                <Video size={10} /> Video
              </span>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--data)] font-semibold mb-1">Ganador del período</div>
              <div className="text-sm font-medium text-white truncate">{winner.campaign_name}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-[var(--hairline)]">
            <div className="px-4 py-4">
              <div className="eyebrow">Leads</div>
              <div className="numeric text-2xl text-[var(--data)] mt-1">{fmtInt(winner.leads)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="eyebrow">CPL</div>
              <div className="numeric text-2xl text-[var(--success)] mt-1">{fmtUSD(winner.cpl)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="eyebrow">Spend</div>
              <div className="numeric text-2xl text-[var(--fg)] mt-1">{fmtUSD(Number(winner.spend))}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
