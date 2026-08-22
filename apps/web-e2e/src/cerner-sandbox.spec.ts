import { expect, test } from '@playwright/test';

test.use({
  ignoreHTTPSErrors: true,
});

test.describe('cerner sandbox integration', () => {
  test.skip(
    process.env.E2E_CERNER_SANDBOX !== 'enabled',
    'hits the shared Cerner sandbox; requires CERNER_CLIENT_ID and an explicit opt-in',
  );

  test('connects to the Cerner sandbox and adds a connection', async ({
    page,
  }) => {
    test.setTimeout(6 * 60_000);

    const instanceConfig = await page.request
      .get('https://localhost:4200/api/v1/instance-config')
      .then((res) => res.json());
    if (!instanceConfig.CERNER_CLIENT_ID) {
      throw new Error(
        'E2E_CERNER_SANDBOX is enabled but the api is not serving Cerner credentials - set CERNER_CLIENT_ID in the api environment',
      );
    }

    await page.goto('https://localhost:4200/connections');
    const skipTutorial = page.getByText('Skip Tutorial');
    if (await skipTutorial.isVisible().catch(() => false)) {
      await skipTutorial.click();
    }

    await page.getByText('Add a new connection').click();
    await page
      .getByRole('button', { name: 'Select Cerner', exact: true })
      .click();

    await page.getByTitle('tenant-search-bar').fill('Cerner Sandbox');
    await page.getByText('Cerner Sandbox (R4)', { exact: true }).click();

    await page.waitForURL(/cerner\.com/, { timeout: 60_000 });
    await page
      .getByRole('textbox', { name: 'Email address or username' })
      .fill('fredricksmart');
    await page.getByRole('textbox', { name: 'Password' }).fill('Cerner01');
    await page.getByRole('button', { name: /Sign In/ }).click();

    for (let i = 0; i < 8; i++) {
      if (page.url().includes('localhost:4200')) break;
      const next = page
        .getByRole('button', { name: /Proceed Anyway|Allow Access/i })
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

    await expect(page.getByText(/Cerner - Cerner Sandbox/).first()).toBeVisible(
      { timeout: 60_000 },
    );
  });
});
