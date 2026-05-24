import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

process.env.AUTH_EMAIL = 'test@example.com';
process.env.AUTH_SECRET = 'test_secret_dev_only_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.META_ACCESS_TOKEN = 'test_token';
process.env.META_API_VERSION = 'v21.0';
process.env.BUDGET_CAP_USD = '1000';

global.fetch = vi.fn();
