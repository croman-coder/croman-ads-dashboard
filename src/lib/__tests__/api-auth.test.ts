import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => name === 'croman_ads_session' ? { value: 'good' } : undefined,
  }),
}));

vi.mock('../auth', () => ({
  verifySessionToken: vi.fn(async (t: string) => t === 'good' ? { email: 'a@b.com' } : null),
  SESSION_CONFIG: { cookieName: 'croman_ads_session' },
}));

import { requireSession } from '../api-auth';

describe('requireSession', () => {
  it('returns session for valid token', async () => {
    const s = await requireSession();
    expect(s).toEqual({ email: 'a@b.com' });
  });
});
