import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { LocalConfigProvider } from '../../../app/providers/LocalConfigProvider';
import { TestProviders } from '../../../test-utils/TestProviders';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import OnPatientRedirect from './OnPatientRedirect';

jest.mock('../../../app/providers/UserProvider', () => ({
  useUser: () => ({ id: 'user-1' }),
}));

function renderCallback(db: RxDatabase<DatabaseCollections>) {
  return render(
    <LocalConfigProvider>
      <TestProviders db={db}>
        <MemoryRouter initialEntries={['/onpatient/callback?session=s-1']}>
          <Routes>
            <Route path="/onpatient/callback" element={<OnPatientRedirect />} />
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

const REFUSAL = {
  ok: false,
  status: 401,
  json: async () => ({
    error: 'registration_token_rejected',
    error_description:
      'Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
  }),
};

describe('OnPatientRedirect app key', () => {
  let db: RxDatabase<DatabaseCollections>;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(async () => {
    db = await createTestDatabase();
    global.fetch = fetchMock;
    fetchMock.mockReset();
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    localStorage.clear();
    await cleanupTestDatabase(db);
  });

  it('sends the saved key, keeps it when refused, and shows why', async () => {
    saveKey('stale-registration-token');
    fetchMock.mockResolvedValue(REFUSAL);

    renderCallback(db);

    await screen.findByText(
      'Error completing authentication: Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/onpatient/tokens?session=s-1',
      { headers: { 'X-Registration-Token': 'stale-registration-token' } },
    );
    expect(savedKey()).toBe('stale-registration-token');
  });

  it('keeps the key when the vendor refuses the code', async () => {
    saveKey('valid-registration-token');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        statusCode: 403,
        message: 'Forbidden: unable to get auth token with code',
      }),
    });

    renderCallback(db);

    await screen.findByText(
      'Error completing authentication: Failed to retrieve tokens',
    );
    await waitFor(() => expect(savedKey()).toBe('valid-registration-token'));
  });
});
