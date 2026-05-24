'use client';

import { Sidebar } from '@/components/Sidebar';
import { Construction } from 'lucide-react';

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-[var(--color-border)] px-6 py-3">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </header>
        <main className="flex-1 p-6">
          <div className="bg-white border border-[var(--color-border)] rounded p-10 flex flex-col items-center justify-center text-center">
            <Construction size={36} className="text-[var(--color-warning)] mb-3" />
            <h2 className="text-xl font-bold text-slate-900 mb-1">{title}</h2>
            <p className="text-sm text-slate-500 max-w-md">{description}</p>
            <div className="mt-4 text-xs text-slate-400 font-mono">Phase 2 · próximamente</div>
          </div>
        </main>
      </div>
    </div>
  );
}
