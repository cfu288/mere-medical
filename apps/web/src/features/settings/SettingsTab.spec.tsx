import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RxDatabase } from 'rxdb';

import { AppConfigProvider } from '../../app/providers/AppConfigProvider';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { DeveloperLogsProvider } from '../../app/providers/DeveloperLogsProvider';
import { LocalConfigProvider } from '../../app/providers/LocalConfigProvider';
import { UserPreferencesProvider } from '../../app/providers/UserPreferencesProvider';
import { UserProvider } from '../../app/providers/UserProvider';
import { createTestClinicalDocument } from '../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { mockColorScheme } from '../../test-utils/matchMedia';
import { TestProviders } from '../../test-utils/TestProviders';
import { createDefaultTestUser } from '../../test-utils/userTestData';
import SettingsTab, { fetchPatientRecords } from './SettingsTab';
import * as UserSwitchDrawer from './components/UserSwitchDrawer';

jest.mock('../sync/SyncJobProvider', () => ({
  usePauseSyncJobs: () => async () => () => undefined,
}));

describe('fetchPatientRecords', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('returns the patient records of the user', async () => {
    const patient = createTestClinicalDocument({
      id: 'conn-a|user-1|patient-1',
      connection_record_id: 'conn-a',
      user_id: 'user-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Ada'], family: 'Lovelace' }],
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'patient',
        version_history: [],
      },
      metadata: { id: 'patient-1', date: '', display_name: 'Ada Lovelace' },
    });
    await db.clinical_documents.bulkInsert([
      patient,
      createTestClinicalDocument({
        id: 'conn-a|user-1|obs-1',
        connection_record_id: 'conn-a',
        user_id: 'user-1',
        metadata: { id: 'obs-1', date: '2022-01-13T12:00:00-05:00' },
      }),
      createTestClinicalDocument({
        id: 'conn-b|user-2|patient-2',
        connection_record_id: 'conn-b',
        user_id: 'user-2',
        data_record: { ...patient.data_record },
        metadata: { id: 'patient-2', date: '', display_name: 'Other' },
      }),
    ]);

    const result = await fetchPatientRecords(db, 'user-1');

    expect(result).toEqual([patient]);
  });
});

describe('SettingsTab', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    globalThis.IS_DEMO = 'disabled';
    globalThis.MERE_APP_VERSION = 'test';
    mockColorScheme(false);
    db = await createTestDatabase();
    await db.user_documents.insert(createDefaultTestUser());
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
    localStorage.clear();
  });

  it('replaces the user switcher with the add user dialog', async () => {
    render(
      <MemoryRouter>
        <LocalConfigProvider>
          <TestProviders db={db}>
            <AppConfigProvider configFetcher={async () => ({})}>
              <DeveloperLogsProvider>
                <UserProvider>
                  <UserPreferencesProvider>
                    <SettingsTab />
                  </UserPreferencesProvider>
                </UserProvider>
              </DeveloperLogsProvider>
            </AppConfigProvider>
          </TestProviders>
        </LocalConfigProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Switch User' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add New User' }),
    );

    expect(
      await screen.findByRole('dialog', { name: 'Add New User' }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Switch user' })).toBeNull(),
    );
    expect(screen.getByRole('dialog', { name: 'Add New User' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the add user dialog open when the user switcher closes late', async () => {
    const drawer = jest.spyOn(UserSwitchDrawer, 'UserSwitchDrawer');
    render(
      <MemoryRouter>
        <LocalConfigProvider>
          <TestProviders db={db}>
            <AppConfigProvider configFetcher={async () => ({})}>
              <DeveloperLogsProvider>
                <UserProvider>
                  <UserPreferencesProvider>
                    <SettingsTab />
                  </UserPreferencesProvider>
                </UserProvider>
              </DeveloperLogsProvider>
            </AppConfigProvider>
          </TestProviders>
        </LocalConfigProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Switch User' }));
    const closeSwitcher = drawer.mock.lastCall![0].onClose;
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add New User' }),
    );
    await screen.findByRole('dialog', { name: 'Add New User' });

    act(() => closeSwitcher());
    // a closing dialog stays on the page until its animation ends
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));

    expect(screen.getByRole('dialog', { name: 'Add New User' })).toBeTruthy();
  });
});
