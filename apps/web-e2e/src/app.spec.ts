import { expect, test } from '@playwright/test';

test.use({
  ignoreHTTPSErrors: true,
});

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

test('Epic add new connection flow works', async ({ page }) => {
  // Go to connections page

  await page.goto('https://localhost:4200/connections');

  await page.click('text=Skip Tutorial');

  // Start add connection flow by clicking on button with text "Log in to Epic MyChart"
  await page.click('text=Add a new connection');

  // See if modal has opened
  await page.waitForSelector('text=Which patient portal do you use?');

  // Click on Epic MyChart option
  await page.getByText('Select MyChart');
  await page.getByText('Select MyChart').click();

  // See if modal has opened
  await page.waitForSelector(
    'text=Select your healthcare institution to log in'
  );

  // Search for Sandbox
  await page.getByTitle('tenant-search-bar').fill('Sandbo');

  // Click on Sandbox - redirected to MyChart
  await page.waitForSelector('text=Sandbox');
  await page.click('text=Sandbox');

  // We are on MyChart login page
  await page.waitForSelector('text=MyChart Username');
  await expect(page).toHaveTitle('MyChart - Login Page');
  await page.click("label[for='Login']", { force: true });
  await page.keyboard.type('fhirderrick');
  await page.click("label[for='Password']", { force: true });
  await page.keyboard.type('epicepic1');
  await page.click('text=Sign In');

  // We have logged in to MyChart
  await page.waitForSelector('text=Mere Medical has said that it:');
  await expect(page).toHaveTitle('MyChart - Are you sure?');
  await page.getByTitle('Continue to next page').click({
    force: true,
    delay: 1000,
  });

  // We are on the MyChart authorize page. Authorize our app for 1 hour.
  await page.waitForSelector('text=What would you like to share?');
  await expect(page).toHaveTitle('MyChart - Are you sure?');
  await page.click('text=1 hour', { force: true, delay: 1000 });
  await page.click('text=Allow access', { force: true, delay: 500 });

  // MyChart has granted access, redirecting back to Mere
  await page.waitForSelector('text=Add Connections');
  await expect(page).toHaveTitle(/Mere/);
  await page.waitForSelector('text=MyChart - Epic MyChart Sandbox');
});
