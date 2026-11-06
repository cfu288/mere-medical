import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { AppConfigProvider } from '../../../app/providers/AppConfigProvider';
import { LocalConfigProvider } from '../../../app/providers/LocalConfigProvider';
import { UserProvider } from '../../../app/providers/UserProvider';
import { UserPreferencesProvider } from '../../../app/providers/UserPreferencesProvider';
import { TestProviders } from '../../../test-utils/TestProviders';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { createSelectedTestUser } from '../../../test-utils/userTestData';
import { TenantSelectModal } from './TenantSelectModal';

const KEYED_CONFIG = {
  PUBLIC_URL: 'https://mere.example',
  NEXTGEN_CLIENT_ID: 'nextgen-id',
  NEXTGEN_SECRET_CONFIGURED: true,
  ONPATIENT_CLIENT_ID: 'onpatient-id',
  ONPATIENT_SECRET_CONFIGURED: true,
  REGISTRATION_TOKEN_REQUIRED: true,
};

function renderModal(db: RxDatabase<DatabaseCollections>) {
  return render(
    <LocalConfigProvider>
      <TestProviders db={db}>
        <AppConfigProvider configFetcher={async () => KEYED_CONFIG}>
          <UserProvider>
            <UserPreferencesProvider>
              <MemoryRouter>
                <TenantSelectModal
                  open={true}
                  setOpen={() => undefined}
                  onClick={() => undefined}
                />
              </MemoryRouter>
            </UserPreferencesProvider>
          </UserProvider>
        </AppConfigProvider>
      </TestProviders>
    </LocalConfigProvider>,
  );
}

describe('TenantSelectModal app key', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeAll(() => {
    window.IntersectionObserver = class {
      observe = jest.fn();
      disconnect = jest.fn();
    } as unknown as typeof IntersectionObserver;
  });

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.user_documents.insert(createSelectedTestUser({ id: 'user-1' }));
    await db.user_preferences.insert({
      id: 'pref-1',
      user_id: 'user-1',
      use_proxy: true,
    });
  });

  afterEach(async () => {
    localStorage.clear();
    await cleanupTestDatabase(db);
  });

  it('blocks NextGen and OnPatient with the invite link message until a token is saved', async () => {
    renderModal(db);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /To connect, open the invite link from your Mere administrator\./,
        ),
      ).toHaveLength(2);
    });
    expect(screen.getAllByText('Open Settings')[0].getAttribute('href')).toBe(
      '/settings#registration_token',
    );
  });

  it('enables them once this browser has a token', async () => {
    localStorage.setItem(
      'config',
      JSON.stringify({ registration_token: 'valid-registration-token' }),
    );
    renderModal(db);

    await screen.findByText('NextGen');
    expect(
      screen.queryByText(/open the invite link from your Mere administrator/),
    ).toBeNull();
  });
});
