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

    // NextGen may show a variable number of consent screens before redirecting
    for (let i = 0; i < 8; i++) {
      if (page.url().includes('localhost:4200')) break;
      const next = page
        .locator('text=/^(Allow|Continue|Accept|Next|Approve|Authorize|Agree)$/i')
        .first();
      if (await next.isVisible().catch(() => false)) {
        await next.click({ force: true });
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
