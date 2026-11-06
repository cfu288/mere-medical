import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RxDatabase } from 'rxdb';
import { OAuthError } from '@mere/fhir-oauth';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { LocalConfigProvider } from '../../../app/providers/LocalConfigProvider';
import { TestProviders } from '../../../test-utils/TestProviders';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import HealowRedirect from './HealowRedirect';

const mockHandleCallback = jest.fn();

jest.mock('@mere/fhir-oauth/react', () => ({
  useOAuthFlow: () => ({
    handleCallback: mockHandleCallback,
    clearSession: jest.fn(),
  }),
}));

jest.mock('../../../app/providers/UserProvider', () => ({
  useUser: () => ({ id: 'user-1' }),
}));

jest.mock('../../../app/providers/UserPreferencesProvider', () => ({
  useUserPreferences: () => ({ use_proxy: false }),
}));

jest.mock('../../../app/providers/AppConfigProvider', () => ({
  ...jest.requireActual('../../../app/providers/AppConfigProvider'),
  useAppConfig: () => ({
    config: {
      HEALOW_CLIENT_ID: 'healow-id',
      HEALOW_CONFIDENTIAL_MODE: true,
      PUBLIC_URL: 'https://mere.example',
    },
    isLoading: false,
  }),
}));

function renderCallback(db: RxDatabase<DatabaseCollections>) {
  return render(
    <LocalConfigProvider>
      <TestProviders db={db}>
        <MemoryRouter initialEntries={['/healow/callback?code=c&state=s']}>
          <Routes>
            <Route path="/healow/callback" element={<HealowRedirect />} />
            <Route
              path="/connections"
              element={<span>Connections page</span>}
            />
          </Routes>
        </MemoryRouter>
      </TestProviders>
    </LocalConfigProvider>,
  );
}

function saveKey(key: string) {
  localStorage.setItem('config', JSON.stringify({ registration_token: key }));
  localStorage.setItem(
    'healowBaseUrl',
    'https://fhir4.eclinicalworks.com/fhir/r4/AAAABA',
  );
  localStorage.setItem(
    'healowAuthUrl',
    'https://oauthserver.eclinicalworks.com/oauth/oauth2/authorize',
  );
  localStorage.setItem(
    'healowTokenUrl',
    'https://oauthserver.eclinicalworks.com/oauth/oauth2/token',
  );
  localStorage.setItem('healowName', 'Abdul Farzin MD');
  localStorage.setItem('healowId', 'AAAABA');
}

function savedKey(): string | undefined {
  return JSON.parse(localStorage.getItem('config') ?? '{}').registration_token;
}

describe('HealowRedirect app key', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
    mockHandleCallback.mockReset();
  });

  afterEach(async () => {
    localStorage.clear();
    await cleanupTestDatabase(db);
  });

  it('keeps a key the instance refused and shows why', async () => {
    saveKey('stale-registration-token');
    mockHandleCallback.mockRejectedValue(
      new OAuthError(
        'registration_token_rejected',
        'Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
      ),
    );

    renderCallback(db);

    await screen.findByText(
      'Error adding connection: Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
    );
    expect(savedKey()).toBe('stale-registration-token');
  });

  it('keeps the key when the vendor refuses the code', async () => {
    saveKey('valid-registration-token');
    mockHandleCallback.mockRejectedValue(
      new OAuthError('invalid_grant', 'Token exchange failed: 400'),
    );

    renderCallback(db);

    await screen.findByText(
      'Error adding connection: Token exchange failed: 400',
    );
    await waitFor(() => expect(savedKey()).toBe('valid-registration-token'));
  });
});
