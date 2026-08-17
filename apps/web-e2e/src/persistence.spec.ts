import { expect, test } from '@playwright/test';
import * as path from 'path';

test.use({
  ignoreHTTPSErrors: true,
});

const demoDataPath = path.join(
  __dirname,
  '../../web/src/assets/demo.json',
);

test.describe('local database persistence', () => {
  test.skip(
    process.env.E2E_DEMO === 'enabled',
    'demo mode uses in-memory storage, where reloads reseed instead of reading the persisted database',
  );

  test('imported records survive page reloads', async ({ page }) => {
    await page.goto('https://localhost:4200/settings');

    const skipTutorial = page.getByText('Skip Tutorial');
    if (await skipTutorial.isVisible().catch(() => false)) {
      await skipTutorial.click();
    }

    await page.setInputFiles(
      'input[type="file"][accept="application/json"]',
      demoDataPath,
    );
    // the app reloads itself ~2s after a successful import
    const selfReload = page.waitForEvent('load', { timeout: 30_000 });
    await expect(
      page.getByText(/documents were successfully imported/),
    ).toBeVisible({ timeout: 60_000 });
    await selfReload;

    await page.goto('https://localhost:4200/timeline');
    await expect(page.getByText('Welcome back John!')).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText('Lowland Community Hospital').first()).toBeVisible({
      timeout: 60_000,
    });

    await page.reload();
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
  });
});
