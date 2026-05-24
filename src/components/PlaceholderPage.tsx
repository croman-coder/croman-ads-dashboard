'use client';

import { Sidebar } from '@/components/Sidebar';
import { Construction } from 'lucide-react';

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-[var(--bg-base)] border-b border-[var(--hairline)] px-8 py-4">
          <h1 className="display text-2xl text-[var(--fg)]">{title}</h1>
        </header>
        <main className="flex-1 p-8">
          <div className="card p-16 flex flex-col items-center justify-center text-center">
            <Construction size={36} className="text-[var(--warning)] mb-4" strokeWidth={1.5} />
            <h2 className="display text-3xl text-[var(--fg)] mb-2">{title}</h2>
            <p className="text-sm text-[var(--fg-muted)] max-w-md leading-relaxed">{description}</p>
            <div className="eyebrow mt-5">Phase 2 · próximamente</div>
          </div>
        </main>
      </div>
    </div>
  );
}
