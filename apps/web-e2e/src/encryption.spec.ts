import { expect, Page, test } from '@playwright/test';
import * as path from 'path';

test.use({
  ignoreHTTPSErrors: true,
});

const demoDataPath = path.join(__dirname, '../../web/src/assets/demo.json');
const password = 'e2e-password-123';

/** Imports the demo records on the Settings tab and waits for the app to reload. */
async function importDemoRecords(page: Page) {
  await page.goto('https://localhost:4200/settings');
  await page
    .getByText('Skip Tutorial')
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  await page.setInputFiles(
    'input[type="file"][accept="application/json"]',
    demoDataPath,
  );
  // The app reloads itself about 2 seconds after a successful import.
  const selfReload = page.waitForEvent('load', { timeout: 30_000 });
  await expect(
    page.getByText(/documents were successfully imported/),
  ).toBeVisible({ timeout: 60_000 });
  await selfReload;
}

/**
 * Opens a tab with its navigation link.
 * A page load asks for the password again when encryption is on.
 */
async function openTab(page: Page, name: 'Timeline' | 'Settings') {
  await page.getByRole('link', { name, exact: true }).first().click();
}

/** Turns encryption on in Settings, then unlocks the app after it reloads. */
async function turnEncryptionOn(page: Page) {
  await openTab(page, 'Settings');
  await page.locator('#encrypt_database [role=switch]').click();
  await page.locator('input#password').fill(password);
  const selfReload = page.waitForEvent('load', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Set Password' }).click();
  await selfReload;
  await expect(page.getByText('Enter your encryption password')).toBeVisible({
    timeout: 60_000,
  });
  await page.locator('input#password').fill(password);
  await page.keyboard.press('Enter');
}

/** Turns encryption off in Settings and waits for the app to reload. */
async function turnEncryptionOff(page: Page) {
  await openTab(page, 'Settings');
  await page.locator('#encrypt_database [role=switch]').click();
  const selfReload = page.waitForEvent('load', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Remove Password' }).click();
  await selfReload;
}

/** Opens the timeline and checks that it shows the imported demo records. */
async function expectDemoRecordsOnTimeline(page: Page) {
  await openTab(page, 'Timeline');
  await expect(page.getByText('Welcome back John!')).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText('Lowland Community Hospital').first(),
  ).toBeVisible({ timeout: 60_000 });
}

/**
 * Counts the records that IndexedDB holds without encryption.
 * RxDB keeps each unencrypted collection in a database named `rxdb-dexie-mere_db--…`.
 */
async function countUnencryptedRecords(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    const names = databases
      .map((database) => database.name ?? '')
      .filter((name) => name.startsWith('rxdb-dexie-mere_db'));
    const counts = await Promise.all(
      names.map(
        (name) =>
          new Promise<number>((resolve, reject) => {
            const open = indexedDB.open(name);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const count = open.result
                .transaction('docs')
                .objectStore('docs')
                .count();
              count.onerror = () => reject(count.error);
              count.onsuccess = () => {
                open.result.close();
                resolve(count.result);
              };
            };
          }),
      ),
    );
    return counts.reduce((total, count) => total + count, 0);
  });
}

/**
 * Lists the encrypted database files that IndexedDB holds.
 * The encrypted database is one file, `mere_db.db`, in the `IDBCatalog` database.
 */
async function listEncryptedFiles(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    // Opening a missing IDBCatalog creates an empty one that the app cannot use.
    if (!databases.some((database) => database.name === 'IDBCatalog')) {
      return [];
    }
    return new Promise<string[]>((resolve, reject) => {
      const open = indexedDB.open('IDBCatalog');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const keys = open.result
          .transaction('IDBAKV')
          .objectStore('IDBAKV')
          .getAll();
        keys.onerror = () => reject(keys.error);
        keys.onsuccess = () => {
          open.result.close();
          resolve(keys.result.map((file) => String(file.appkey)));
        };
      };
    });
  });
}

test.describe('database encryption toggle', () => {
  test.skip(
    process.env.E2E_DEMO === 'enabled',
    'demo mode uses in-memory storage, which has no database to encrypt',
  );

  test('turning encryption on keeps the records and deletes the unencrypted copy', async ({
    page,
  }) => {
    await importDemoRecords(page);
    await expectDemoRecordsOnTimeline(page);
    expect(await countUnencryptedRecords(page)).toBeGreaterThan(0);
    expect(await listEncryptedFiles(page)).toEqual([]);

    await turnEncryptionOn(page);

    await expectDemoRecordsOnTimeline(page);
    expect(await countUnencryptedRecords(page)).toBe(0);
    expect(await listEncryptedFiles(page)).toEqual([
      expect.stringContaining('mere_db.db'),
    ]);
  });

  test('turning encryption off keeps the records and deletes the encrypted file', async ({
    page,
  }) => {
    await importDemoRecords(page);
    await turnEncryptionOn(page);
    await expectDemoRecordsOnTimeline(page);
    expect(await listEncryptedFiles(page)).toEqual([
      expect.stringContaining('mere_db.db'),
    ]);

    await turnEncryptionOff(page);

    await expectDemoRecordsOnTimeline(page);
    expect(await countUnencryptedRecords(page)).toBeGreaterThan(0);
    expect(await listEncryptedFiles(page)).toEqual([]);
  });
});
