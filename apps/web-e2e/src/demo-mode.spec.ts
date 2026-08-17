import { expect, test } from '@playwright/test';

test.use({
  ignoreHTTPSErrors: true,
});

test.describe('demo mode', () => {
  test.skip(
    process.env.E2E_DEMO !== 'enabled',
    'requires the web app to be served with IS_DEMO=enabled',
  );

  test('seeds demo data and renders it across tabs', async ({ page }) => {
    await page.goto('https://localhost:4200/timeline');

    await expect(page.getByText('Welcome back John!')).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText('Lowland Community Hospital').first()).toBeVisible({
      timeout: 60_000,
    });

    await page.goto('https://localhost:4200/connections');
    await expect(page.getByText('Blessings Clinic').first()).toBeVisible({
      timeout: 30_000,
    });

    await page.goto('https://localhost:4200/summary');
    await expect(page.getByText('Medications').first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
