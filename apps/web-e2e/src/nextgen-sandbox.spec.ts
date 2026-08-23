import { expect, test } from '@playwright/test';

test.use({
  ignoreHTTPSErrors: true,
});

test.describe('nextgen sandbox integration', () => {
  test.skip(
    process.env.E2E_NEXTGEN_SANDBOX !== 'enabled',
    'hits the NextGen sandbox; requires NEXTGEN_CLIENT_ID and NEXTGEN_CLIENT_SECRET on the api and an explicit opt-in',
  );

  test('connects to the NextGen sandbox and adds a connection', async ({
    page,
  }) => {
    test.setTimeout(6 * 60_000);

    const instanceConfig = await page.request
      .get('https://localhost:4200/api/v1/instance-config')
      .then((res) => res.json());
    if (
      !instanceConfig.NEXTGEN_CLIENT_ID ||
      !instanceConfig.NEXTGEN_SECRET_CONFIGURED
    ) {
      throw new Error(
        'E2E_NEXTGEN_SANDBOX is enabled but the api is not serving NextGen credentials - set NEXTGEN_CLIENT_ID and NEXTGEN_CLIENT_SECRET in the api environment',
      );
    }

    await page.goto('https://localhost:4200/connections');
    const skipTutorial = page.getByText('Skip Tutorial');
    if (await skipTutorial.isVisible().catch(() => false)) {
      await skipTutorial.click();
    }

    await page.getByText('Add a new connection').click();
    await page
      .getByRole('button', { name: 'Select NextGen', exact: true })
      .click();

    await page.waitForURL(/fhir\.nextgen\.com/, { timeout: 60_000 });
    await page.locator('input[name="Username"]').fill('patientapitest');
    await page.locator('input[name="Password"]').fill('Password1!');
    await page.getByRole('button', { name: 'Next' }).click();

    // The consent submit button fails Playwright's visibility check, so click via the DOM
    for (let i = 0; i < 8; i++) {
      if (page.url().includes('localhost:4200')) break;
      const allow = page
        .locator('button[value="allow"], button#btnAllow')
        .first();
      if ((await allow.count().catch(() => 0)) > 0) {
        await allow
          .evaluate((el) => (el as HTMLButtonElement).click())
          .catch(() => undefined);
      }
      await page
        .waitForURL(/localhost:4200/, { timeout: 10_000 })
        .catch(() => undefined);
    }

    await page.waitForURL(/localhost:4200.*connections/, {
      timeout: 180_000,
    });

    await expect(page.getByText(/NextGen - /).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
