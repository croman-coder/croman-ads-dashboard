'use client';

import { useEffect, useState } from 'react';

export function useApprovalCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const r = await fetch('/api/proposals?count=true');
        const j = await r.json();
        if (!stop && typeof j.count === 'number') setCount(j.count);
      } catch {}
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => { stop = true; clearInterval(id); };
  }, []);
  return count;
}
