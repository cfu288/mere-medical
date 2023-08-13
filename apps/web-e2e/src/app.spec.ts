import { expect, test } from '@playwright/test';

test('Timeline tab loads', async ({ page }) => {
  await page.goto('https://localhost:4200/timeline');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Mere/);
});

test('Connections tab loads', async ({ page }) => {
  await page.goto('https://localhost:4200/connections');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Mere/);
});

test('Summary tab loads', async ({ page }) => {
  await page.goto('https://localhost:4200/summary');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Mere/);
});

test('Settings tab loads', async ({ page }) => {
  await page.goto('https://localhost:4200/settings');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Mere/);
});
