import { chromium, expect, test } from '@playwright/test';
import * as path from 'path';

const APP = process.env.E2E_APP_URL || 'https://localhost:4200';

/**
 * RxDB keeps the connection and its tokens in IndexedDB, which `storageState`
 * does not capture, so the session is reused via a persistent browser profile.
 */
const PROFILE_DIR =
  process.env.E2E_EPIC_PROXY_PROFILE ||
  path.join(__dirname, '..', '.epic-proxy-profile');

test.describe('epic sandbox sync through the api proxy', () => {
  test.skip(
    process.env.E2E_EPIC_SANDBOX !== 'enabled',
    'hits the shared Epic sandbox; requires EPIC_SANDBOX_CLIENT_ID_R4 and an explicit opt-in',
  );

  test('syncs the Epic sandbox with use_proxy enabled', async () => {
    test.setTimeout(8 * 60_000);

    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      ignoreHTTPSErrors: true,
    });
    const page = context.pages()[0] || (await context.newPage());

    const proxyCalls: { targetType: string; status: number }[] = [];
    page.on('response', (res) => {
      const url = new URL(res.url());
      if (url.pathname.endsWith('/api/proxy')) {
        proxyCalls.push({
          targetType: url.searchParams.get('target_type') || '(none)',
          status: res.status(),
        });
      }
    });

    try {
      await page.goto(`${APP}/connections`);
      const skipTutorial = page.getByText('Skip Tutorial');
      if (await skipTutorial.isVisible().catch(() => false)) {
        await skipTutorial.click();
      }

      await page.goto(`${APP}/settings`);
      const proxySwitch = page.locator('#use_proxy').getByRole('switch').first();
      await proxySwitch.waitFor({ state: 'visible', timeout: 60_000 });
      if ((await proxySwitch.getAttribute('aria-checked')) !== 'true') {
        await proxySwitch.click();
      }
      await expect(proxySwitch).toHaveAttribute('aria-checked', 'true');

      await page.goto(`${APP}/connections`);
      const card = page.getByText(/MyChart - Epic MyChart Sandbox/).first();
      const alreadyConnected = await card
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true)
        .catch(() => false);

      if (!alreadyConnected) {
        await connectEpicSandbox(page);
      }
      await expect(card).toBeVisible({ timeout: 90_000 });

      const before = proxyCalls.length;
      await page.getByRole('button', { name: 'Sync', exact: true }).first().click();

      const syncing = page.getByText(/Syncing now/).first();
      await expect(syncing).toBeVisible({ timeout: 60_000 });
      await expect(syncing).toBeHidden({ timeout: 5 * 60_000 });

      const duringSync = proxyCalls.slice(before);
      const fhirCalls = duringSync.filter((c) => c.targetType === 'base');
      const failures = duringSync.filter((c) => c.status >= 400);

      expect(fhirCalls.length).toBeGreaterThan(0);
      expect(failures).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

async function connectEpicSandbox(page: import('@playwright/test').Page) {
  await page.getByText('Add a new connection').click();
  await page
    .getByRole('button', { name: 'Select MyChart', exact: true })
    .click();
  await page.getByTitle('tenant-search-bar').fill('Epic MyChart Sandbox');
  await page.getByText('Epic MyChart Sandbox (R4)', { exact: true }).click();

  await page.waitForURL(/fhir\.epic\.com/, { timeout: 90_000 });
  await page
    .getByRole('textbox', { name: 'MyChart Username' })
    .fill('fhirjason');
  await page.getByRole('textbox', { name: 'Password' }).fill('epicepic1');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  for (let i = 0; i < 10; i++) {
    if (page.url().includes('localhost')) break;
    const expiration = page.getByRole('radio', { name: '3 months' });
    if (await expiration.isVisible().catch(() => false)) {
      await expiration.check({ force: true });
      await page.getByRole('button', { name: /Allow access/ }).click();
    } else {
      const next = page
        .locator('text=/^(Continue|Accept|Next|Approve)$/i')
        .first();
      if (await next.isVisible().catch(() => false)) {
        await next.click({ force: true });
      }
    }
    await page
      .waitForURL(/localhost/, { timeout: 10_000 })
      .catch(() => undefined);
  }

  await page.waitForURL(/localhost.*connections/, { timeout: 180_000 });
}
