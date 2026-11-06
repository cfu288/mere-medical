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
import NextGenRedirect from './NextGenRedirect';

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

jest.mock('../../../app/providers/AppConfigProvider', () => ({
  ...jest.requireActual('../../../app/providers/AppConfigProvider'),
  useAppConfig: () => ({
    config: {
      NEXTGEN_CLIENT_ID: 'nextgen-id',
      PUBLIC_URL: 'https://mere.example',
    },
    isLoading: false,
  }),
}));

function renderCallback(db: RxDatabase<DatabaseCollections>) {
  return render(
    <LocalConfigProvider>
      <TestProviders db={db}>
        <MemoryRouter initialEntries={['/nextgen/callback?code=c&state=s']}>
          <Routes>
            <Route path="/nextgen/callback" element={<NextGenRedirect />} />
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
}

function savedKey(): string | undefined {
  return JSON.parse(localStorage.getItem('config') ?? '{}').registration_token;
}

describe('NextGenRedirect app key', () => {
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
