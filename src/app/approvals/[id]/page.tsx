'use client';

import { useEffect, useState, use } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ApprovalCard } from '@/components/ApprovalCard';
import { useAccount } from '@/lib/use-account';
import type { Proposal } from '@/lib/proposal-store';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { account, setAccount } = useAccount();
  const [p, setP] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch(`/api/proposals/${id}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setP(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar selected={account} onSelect={setAccount} />
        <main className="flex-1 px-8 py-8 max-w-[900px] mx-auto w-full space-y-6">
          <Link href="/approvals" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] flex items-center gap-1">
            <ArrowLeft size={14} /> Volver
          </Link>
          {error && <div className="text-[var(--danger)] text-sm">{error}</div>}
          {p && <ApprovalCard proposal={p} onChange={load} />}
          {p && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--fg)] mb-3">Detalle técnico</h3>
              <pre className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--fg-muted)] overflow-x-auto">
                {JSON.stringify(p, null, 2)}
              </pre>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
