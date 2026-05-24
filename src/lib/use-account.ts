'use client';

import { useState, useEffect } from 'react';

const KEY = 'croman_ads_selected_account';

export function useAccount() {
  const [account, setAccountState] = useState('');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (stored) setAccountState(stored);
  }, []);

  function setAccount(id: string) {
    setAccountState(id);
    if (typeof window !== 'undefined') localStorage.setItem(KEY, id);
  }

  return { account, setAccount };
}
