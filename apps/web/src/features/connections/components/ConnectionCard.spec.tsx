import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { EpicConnectionDocument } from '../../../models/connection-document/ConnectionDocument.type';
import { TestProviders } from '../../../test-utils/TestProviders';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { createEpicConnection } from '../../../test-utils/connectionTestData';
import { ConnectionCard, getConnectionStatus } from './ConnectionCard';

let mockSyncJobs: Record<string, unknown> = {};

jest.mock('../../sync/SyncJobProvider', () => ({
  useSyncJobContext: () => mockSyncJobs,
  useSyncJobDispatchContext: () => jest.fn(),
}));

jest.mock('../../../app/providers/UserProvider', () => ({
  useUser: () => ({ id: 'test-user-id' }),
}));

jest.mock('../../../app/providers/UserPreferencesProvider', () => ({
  useUserPreferences: () => ({ use_proxy: false }),
}));

jest.mock('../../../app/providers/AppConfigProvider', () => ({
  ...jest.requireActual('../../../app/providers/AppConfigProvider'),
  useConfig: () => ({ PUBLIC_URL: 'https://mere.example' }),
}));

const doc = (fields: Record<string, unknown>) => ({
  get: (key: string) => fields[key],
});

describe('getConnectionStatus', () => {
  it('shows a running sync over the previous error', () => {
    expect(
      getConnectionStatus(doc({ last_sync_was_error: true }), true),
    ).toStrictEqual({ status: 'syncing' });
  });

  it('reports an error with the last successful sync', () => {
    expect(
      getConnectionStatus(
        doc({ last_sync_was_error: true, last_refreshed: '2026-01-01' }),
        false,
      ),
    ).toStrictEqual({ status: 'error', lastSynced: '2026-01-01' });
  });

  it('is connected when the last sync succeeded or never ran', () => {
    expect(getConnectionStatus(doc({}), false)).toStrictEqual({
      status: 'connected',
      lastSynced: undefined,
    });
  });

  it('reports the last successful sync of a healthy connection', () => {
    expect(
      getConnectionStatus(
        doc({ last_sync_was_error: false, last_refreshed: '2026-01-01' }),
        false,
      ),
    ).toStrictEqual({ status: 'connected', lastSynced: '2026-01-01' });
  });
});

describe('ConnectionCard', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    mockSyncJobs = {};
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  async function renderCard(overrides: Partial<EpicConnectionDocument>) {
    const item = await db.connection_documents.insert(
      createEpicConnection({ id: 'connection-1', ...overrides }),
    );
    const card = () => (
      <TestProviders db={db}>
        <MemoryRouter>
          <ConnectionCard item={item} />
        </MemoryRouter>
      </TestProviders>
    );
    const view = render(card());
    return { rerender: () => view.rerender(card()) };
  }

  const button = (name: string) =>
    screen.getByText(name).closest('button') as HTMLButtonElement;

  it('shows the error and the Fix button when the last sync failed', async () => {
    await renderCard({ last_sync_was_error: true });

    expect(screen.getByText('Unable to sync')).toBeTruthy();
    expect(screen.getByText('Fix')).toBeTruthy();
    expect(button('Disconnect Source').disabled).toBe(false);
  });

  it('shows the running sync instead of the previous error', async () => {
    mockSyncJobs = { 'connection-1': {} };
    await renderCard({ last_sync_was_error: true });

    expect(screen.getByText('Syncing now...')).toBeTruthy();
    expect(screen.queryByText('Unable to sync')).toBeNull();
    expect(screen.queryByText('Fix')).toBeNull();
  });

  it('disables Disconnect Source while the connection syncs', async () => {
    mockSyncJobs = { 'connection-1': {} };
    await renderCard({});

    expect(button('Disconnect Source').disabled).toBe(true);
  });

  it('leaves Disconnect Source enabled while another connection syncs', async () => {
    mockSyncJobs = { 'connection-2': {} };
    await renderCard({});

    expect(button('Disconnect Source').disabled).toBe(false);
  });

  it('disables Remove when a sync starts while the confirm dialog is open', async () => {
    const { rerender } = await renderCard({});
    fireEvent.click(button('Disconnect Source'));
    await screen.findByText('Remove');
    expect(button('Remove').disabled).toBe(false);

    mockSyncJobs = { 'connection-1': {} };
    act(rerender);

    expect(button('Remove').disabled).toBe(true);
  });
});
