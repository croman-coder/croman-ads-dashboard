'use client';

import { useEffect, useState } from 'react';
import { useAccount } from './use-account';

export function useAlertCount(): number {
  const { account } = useAccount();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!account) {
      setCount(0);
      return;
    }
    let cancelled = false;
    fetch(`/api/diagnostics?account_id=${account}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.alerts) setCount(j.alerts.length);
      })
      .catch(() => setCount(0));
    return () => {
      cancelled = true;
    };
  }, [account]);

  return count;
}
