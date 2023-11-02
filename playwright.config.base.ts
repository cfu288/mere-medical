import { PlaywrightTestConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4200/';

export const baseConfig: PlaywrightTestConfig = {
  retries: 2,
  maxFailures: 3,
  use: {
    baseURL,
  },
  timeout: 5 * 60 * 1000,
  reporter: process.env.CI ? 'dot' : 'list',
};
