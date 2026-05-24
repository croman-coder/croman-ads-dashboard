'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAccount } from '@/lib/use-account';
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

export default function SettingsPage() {
  const { account, setAccount } = useAccount();
  const [tokenOk, setTokenOk] = useState<boolean | null>(null);
  const [accountCount, setAccountCount] = useState(0);

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) {
          setTokenOk(false);
        } else {
          setTokenOk(true);
          setAccountCount(j.data?.length || 0);
        }
      })
      .catch(() => setTokenOk(false));
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 p-6 space-y-4 max-w-3xl">
          <h1 className="text-2xl font-bold text-slate-900">Ajustes</h1>
          <p className="text-sm text-slate-500">Configuración del entorno y credenciales</p>

          <div className="bg-white border border-[var(--color-border)] rounded p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Meta Access Token</h2>
            {tokenOk === null && <div className="text-sm text-slate-500">Verificando…</div>}
            {tokenOk === true && (
              <div className="flex items-start gap-3">
                <CheckCircle className="text-emerald-600 mt-0.5" size={20} />
                <div>
                  <div className="font-medium text-emerald-700">Token activo</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {accountCount} cuentas accesibles. Token configurado vía variable de entorno <code className="font-mono bg-slate-100 px-1 rounded">META_ACCESS_TOKEN</code>.
                  </div>
                </div>
              </div>
            )}
            {tokenOk === false && (
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-600 mt-0.5" size={20} />
                <div>
                  <div className="font-medium text-red-700">Token inválido o no configurado</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Agregar <code className="font-mono bg-slate-100 px-1 rounded">META_ACCESS_TOKEN</code> en Environment Variables de Vercel.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-[var(--color-border)] rounded p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Repositorio</h2>
            <a
              href="https://github.com/croman-coder/croman-ads-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
            >
              croman-coder/croman-ads-dashboard
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="bg-white border border-[var(--color-border)] rounded p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Versión + roadmap</h2>
            <ul className="text-sm space-y-2 text-slate-700">
              <li>✓ Phase 1: Dashboard read-only (KPIs, charts, tabla)</li>
              <li>✓ Phase 2: Mutations (status, rename, targeting, budget)</li>
              <li>✓ Phase 3: Creative manager (form swap, image upload, wizard)</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
            <strong>⚠ Seguridad:</strong> Todos los mutations se ejecutan inmediatamente contra Meta API.
            Las operaciones quedan loggeadas en el lado Meta. Verificar antes de confirmar acciones destructivas.
          </div>
        </main>
      </div>
    </div>
  );
}
