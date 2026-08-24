import { expect, test } from '@playwright/test';

test.use({
  ignoreHTTPSErrors: true,
});

async function open(page: import('@playwright/test').Page, route: string) {
  await page.goto(`https://localhost:4200/${route}`);
  const skipTutorial = page.getByText('Skip Tutorial');
  if (await skipTutorial.isVisible().catch(() => false)) {
    await skipTutorial.click();
  }
}

test('Timeline tab loads', async ({ page }) => {
  await open(page, 'timeline');

  await expect(
    page.getByText('Your recent medical updates').first(),
  ).toBeVisible({
    timeout: 60_000,
  });
});

test('Connections tab loads', async ({ page }) => {
  await open(page, 'connections');

  await expect(page.getByText('Connect to Patient Portal')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText('Add a new connection')).toBeVisible({
    timeout: 60_000,
  });
});

test('Summary tab loads', async ({ page }) => {
  await open(page, 'summary');

  await expect(page.getByText('Bookmarked Labs')).toBeVisible({
    timeout: 60_000,
  });
});

test('Settings tab loads', async ({ page }) => {
  await open(page, 'settings');

  await expect(page.getByText('Privacy and Security')).toBeVisible({
    timeout: 60_000,
  });
});
