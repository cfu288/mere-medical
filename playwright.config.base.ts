import { PlaywrightTestConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4200/';

export const baseConfig: PlaywrightTestConfig = {
  retries: 2,
  maxFailures: 3,
  timeout: 30000,
  use: {
    baseURL,
  },
};
