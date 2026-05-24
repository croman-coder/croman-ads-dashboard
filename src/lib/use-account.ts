'use client';

import { useState, useEffect } from 'react';

export const ACCOUNT_STORAGE_KEY = 'croman_ads_selected_account';
const EVENT = 'croman:account-changed';

export function useAccount() {
  const [account, setAccountState] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(ACCOUNT_STORAGE_KEY) || '';
    setAccountState(stored);
    setHydrated(true);

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setAccountState(detail || '');
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACCOUNT_STORAGE_KEY) setAccountState(e.newValue || '');
    };
    window.addEventListener(EVENT, onChange as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function setAccount(id: string) {
    setAccountState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCOUNT_STORAGE_KEY, id);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
    }
  }

  return { account, setAccount, hydrated };
}
