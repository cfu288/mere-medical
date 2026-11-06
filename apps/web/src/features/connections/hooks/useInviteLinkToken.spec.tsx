import { render, screen, waitFor } from '@testing-library/react';
import {
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes as RouterRoutes,
  useLocation,
} from 'react-router-dom';
import { RxDatabase } from 'rxdb';
import {
  AppConfig,
  AppConfigProvider,
} from '../../../app/providers/AppConfigProvider';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { LocalConfigProvider } from '../../../app/providers/LocalConfigProvider';
import { TestProviders } from '../../../test-utils/TestProviders';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { useInviteLinkToken } from './useInviteLinkToken';

function Layout() {
  useInviteLinkToken();
  const { pathname, hash } = useLocation();
  return (
    <>
      <span data-testid="location">{`${pathname}${hash}`}</span>
      <Outlet />
    </>
  );
}

const KEYED_CONFIG: AppConfig = {
  PUBLIC_URL: 'https://mere.example',
  REGISTRATION_TOKEN_REQUIRED: true,
  APP_CONTACT: 'admin@mere.example',
};

function renderAt(db: RxDatabase<DatabaseCollections>, url: string) {
  return render(
    <LocalConfigProvider>
      <TestProviders db={db}>
        <AppConfigProvider configFetcher={async () => KEYED_CONFIG}>
          <MemoryRouter initialEntries={[url]}>
            <RouterRoutes>
              <Route element={<Layout />}>
                <Route path="/timeline" element={<span>Timeline page</span>} />
                <Route path="/settings" element={<span>Settings page</span>} />
                <Route path="*" element={<Navigate to="/timeline" />} />
              </Route>
            </RouterRoutes>
          </MemoryRouter>
        </AppConfigProvider>
      </TestProviders>
    </LocalConfigProvider>,
  );
}

function savedKey(): string | undefined {
  return JSON.parse(localStorage.getItem('config') ?? '{}').registration_token;
}

describe('useInviteLinkToken', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    localStorage.clear();
    await cleanupTestDatabase(db);
  });

  it('saves the token from a root invite link and lands on the timeline', async () => {
    renderAt(
      db,
      '/#registration-token=3ebnq9Avix4S-QZ4rLC47V-crei4F3IT7PqAOFSlCeA',
    );

    await screen.findByText('Invite link saved.');
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/timeline');
    });
    expect(savedKey()).toBe('3ebnq9Avix4S-QZ4rLC47V-crei4F3IT7PqAOFSlCeA');
    expect(screen.getByText('Timeline page')).toBeTruthy();
  });

  it('keeps the current page when the link names one', async () => {
    renderAt(
      db,
      '/settings#registration-token=3ebnq9Avix4S-QZ4rLC47V-crei4F3IT7PqAOFSlCeA',
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/settings');
    });
    expect(savedKey()).toBe('3ebnq9Avix4S-QZ4rLC47V-crei4F3IT7PqAOFSlCeA');
    expect(screen.getByText('Settings page')).toBeTruthy();
  });

  it('reports a malformed link and keeps the saved token', async () => {
    localStorage.setItem(
      'config',
      JSON.stringify({ registration_token: 'saved-registration-token' }),
    );
    renderAt(db, '/#registration-token=abc');

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/timeline');
    });
    await screen.findByText(
      'This invite link is not valid. Ask your Mere administrator (admin@mere.example) for a new one.',
    );
    expect(savedKey()).toBe('saved-registration-token');
  });

  it('reports a link that carries an app key instead of a token', async () => {
    renderAt(db, '/#registration-token=valid-app-key-for-the-test-suite');

    await screen.findByText(
      'This invite link is not valid. Ask your Mere administrator (admin@mere.example) for a new one.',
    );
    expect(savedKey()).toBeUndefined();
  });

  it('leaves other fragments alone', async () => {
    renderAt(db, '/timeline#record-1');

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(
        '/timeline#record-1',
      );
    });
    expect(savedKey()).toBeUndefined();
  });
});
