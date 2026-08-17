import { expect, test } from '@playwright/test';

test.use({
  ignoreHTTPSErrors: true,
});

test.describe('epic sandbox integration', () => {
  test.skip(
    process.env.E2E_EPIC_SANDBOX !== 'enabled',
    'hits the shared Epic sandbox; requires EPIC_SANDBOX_CLIENT_ID_R4 and an explicit opt-in',
  );

  test('connects to the Epic sandbox and adds a connection', async ({ page }) => {
    test.setTimeout(6 * 60_000);

    await page.goto('https://localhost:4200/connections');
    const skipTutorial = page.getByText('Skip Tutorial');
    if (await skipTutorial.isVisible().catch(() => false)) {
      await skipTutorial.click();
    }

    await page.getByText('Add a new connection').click();
    await page.getByRole('button', { name: 'Select MyChart', exact: true }).click();

    await page.getByTitle('tenant-search-bar').fill('Epic MyChart Sandbox');
    await page
      .getByText('Epic MyChart Sandbox (R4)', { exact: true })
      .click();

    await page.waitForURL(/fhir\.epic\.com/, { timeout: 60_000 });
    await page
      .getByRole('textbox', { name: 'MyChart Username' })
      .fill('fhirjason');
    await page.getByRole('textbox', { name: 'Password' }).fill('epicepic1');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    // Epic shows a variable number of consent interstitials before redirecting
    for (let i = 0; i < 8; i++) {
      if (page.url().includes('localhost:4200')) break;
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
        .waitForURL(/localhost:4200/, { timeout: 10_000 })
        .catch(() => undefined);
    }

    await page.waitForURL(/localhost:4200.*connections/, {
      timeout: 180_000,
    });

    await expect(
      page.getByText(/MyChart - Epic MyChart Sandbox/).first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
