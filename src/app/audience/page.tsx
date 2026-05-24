'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ToastStack } from '@/components/Toast';
import { useToasts } from '@/lib/use-toasts';
import { useAccount } from '@/lib/use-account';
import { RefreshCw, Save } from 'lucide-react';

type AdSet = {
  id: string;
  name: string;
  campaign_id: string;
  effective_status: string;
  targeting?: Record<string, unknown>;
};

const FB_POSITIONS = ['feed', 'facebook_reels', 'story', 'marketplace', 'instream_video', 'facebook_reels_overlay', 'search'];
const IG_POSITIONS = ['stream', 'reels', 'story', 'explore', 'explore_grid_home'];
const DEVICE_OPTS = ['mobile', 'desktop'];
const PLATFORMS = ['facebook', 'instagram', 'audience_network', 'messenger'];

export default function AudiencePage() {
  const { account, setAccount } = useAccount();
  const [rows, setRows] = useState<AdSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdSet | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/adsets?account_id=${account}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setRows(j.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Audiencia</h1>
              <p className="text-sm text-slate-500">Editor de targeting por ad set — edad, género, geo, placements, dispositivo</p>
            </div>
            <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Recargar
            </button>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Adset list */}
            <div className="lg:col-span-5 bg-white border border-[var(--color-border)] rounded overflow-hidden">
              <div className="px-4 py-2 border-b border-[var(--color-border)] text-sm font-semibold text-slate-700">
                Ad Sets ({rows.length})
              </div>
              <div className="overflow-y-auto max-h-[70vh]">
                {rows.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={`block w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      selected?.id === a.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{a.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{a.id}</div>
                      </div>
                      <StatusBadge status={a.effective_status} />
                    </div>
                  </button>
                ))}
                {rows.length === 0 && !loading && (
                  <div className="p-8 text-center text-slate-400 text-sm">Sin ad sets</div>
                )}
              </div>
            </div>

            {/* Targeting editor */}
            <div className="lg:col-span-7">
              {selected ? (
                <TargetingEditor
                  adset={selected}
                  onSaved={() => { push('Targeting actualizado', 'success'); load(); }}
                  onError={(m) => push(m, 'error')}
                />
              ) : (
                <div className="bg-white border border-[var(--color-border)] rounded p-8 text-center text-slate-500">
                  Seleccioná un ad set para editar targeting
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function TargetingEditor({
  adset,
  onSaved,
  onError,
}: {
  adset: AdSet;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const t = (adset.targeting || {}) as Record<string, unknown>;
  const [ageMin, setAgeMin] = useState((t.age_min as number) || 18);
  const [ageMax, setAgeMax] = useState((t.age_max as number) || 65);
  const [genders, setGenders] = useState<number[]>((t.genders as number[]) || []);
  const [fbPos, setFbPos] = useState<string[]>((t.facebook_positions as string[]) || []);
  const [igPos, setIgPos] = useState<string[]>((t.instagram_positions as string[]) || []);
  const [devices, setDevices] = useState<string[]>((t.device_platforms as string[]) || ['mobile']);
  const [platforms, setPlatforms] = useState<string[]>((t.publisher_platforms as string[]) || ['facebook', 'instagram']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t2 = (adset.targeting || {}) as Record<string, unknown>;
    setAgeMin((t2.age_min as number) || 18);
    setAgeMax((t2.age_max as number) || 65);
    setGenders((t2.genders as number[]) || []);
    setFbPos((t2.facebook_positions as string[]) || []);
    setIgPos((t2.instagram_positions as string[]) || []);
    setDevices((t2.device_platforms as string[]) || ['mobile']);
    setPlatforms((t2.publisher_platforms as string[]) || ['facebook', 'instagram']);
  }, [adset.id, adset.targeting]);

  function toggle<T>(arr: T[], v: T, setter: (v: T[]) => void) {
    if (arr.includes(v)) setter(arr.filter((x) => x !== v));
    else setter([...arr, v]);
  }

  async function save() {
    setSaving(true);
    try {
      const next = JSON.parse(JSON.stringify(adset.targeting || {})) as Record<string, unknown>;
      delete next.age_range;
      next.age_min = ageMin;
      next.age_max = ageMax;
      next.geo_locations = { countries: ['PY'] };
      delete next.excluded_geo_locations;
      if (genders.length > 0) next.genders = genders;
      else delete next.genders;
      next.publisher_platforms = platforms;
      next.facebook_positions = fbPos;
      next.instagram_positions = igPos;
      next.device_platforms = devices;
      next.targeting_automation = { advantage_audience: 0 };

      const r = await fetch('/api/mutation/targeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adset_id: adset.id, targeting: next }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-[var(--color-border)] rounded p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-slate-900">{adset.name}</h3>
        <p className="text-[11px] text-slate-400 font-mono">{adset.id}</p>
      </div>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Edad</h4>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={13}
            max={65}
            value={ageMin}
            onChange={(e) => setAgeMin(Number(e.target.value))}
            className="w-20 px-2 py-1.5 border border-[var(--color-border)] rounded text-sm font-mono"
          />
          <span className="text-slate-400">→</span>
          <input
            type="number"
            min={13}
            max={65}
            value={ageMax}
            onChange={(e) => setAgeMax(Number(e.target.value))}
            className="w-20 px-2 py-1.5 border border-[var(--color-border)] rounded text-sm font-mono"
          />
          <span className="text-xs text-slate-500">años</span>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Género</h4>
        <div className="flex gap-2">
          {[
            { v: 1, l: 'Masculino' },
            { v: 2, l: 'Femenino' },
          ].map((g) => (
            <button
              key={g.v}
              onClick={() => toggle(genders, g.v, setGenders)}
              className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                genders.includes(g.v)
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-white border-[var(--color-border)] hover:bg-slate-50'
              }`}
            >
              {g.l}
            </button>
          ))}
          <button
            onClick={() => setGenders([])}
            className={`px-3 py-1.5 rounded text-sm border ${
              genders.length === 0
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-white border-[var(--color-border)] hover:bg-slate-50'
            }`}
          >
            Todos
          </button>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Plataformas</h4>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <Chip key={p} label={p} active={platforms.includes(p)} onClick={() => toggle(platforms, p, setPlatforms)} />
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Facebook positions</h4>
        <div className="flex flex-wrap gap-2">
          {FB_POSITIONS.map((p) => (
            <Chip key={p} label={p} active={fbPos.includes(p)} onClick={() => toggle(fbPos, p, setFbPos)} />
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Instagram positions</h4>
        <div className="flex flex-wrap gap-2">
          {IG_POSITIONS.map((p) => (
            <Chip key={p} label={p} active={igPos.includes(p)} onClick={() => toggle(igPos, p, setIgPos)} />
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Dispositivo</h4>
        <div className="flex gap-2">
          {DEVICE_OPTS.map((d) => (
            <Chip key={d} label={d} active={devices.includes(d)} onClick={() => toggle(devices, d, setDevices)} />
          ))}
        </div>
      </section>

      <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
        <p className="text-xs text-slate-500">
          ⚠ Guardar reinicia learning phase. CPL puede subir temporal 24-72h.
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Guardando…' : 'Guardar targeting'}
        </button>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
        active
          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
          : 'bg-white border-[var(--color-border)] text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}
