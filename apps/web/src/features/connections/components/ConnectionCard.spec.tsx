import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
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

describe('getConnectionStatus', () => {
  it('shows a running sync over the previous error', () => {
    const connection = new Map([['last_sync_was_error', true]]);

    expect(getConnectionStatus(connection, true)).toStrictEqual({
      status: 'syncing',
    });
  });

  it('reports an error with the last successful sync', () => {
    const connection = new Map<string, unknown>([
      ['last_sync_was_error', true],
      ['last_refreshed', '2026-01-01'],
    ]);

    expect(getConnectionStatus(connection, false)).toStrictEqual({
      status: 'error',
      lastSynced: '2026-01-01',
    });
  });

  it('is connected when no sync ran yet', () => {
    const connection = new Map();

    expect(getConnectionStatus(connection, false)).toStrictEqual({
      status: 'connected',
      lastSynced: undefined,
    });
  });

  it('reports the last successful sync of a healthy connection', () => {
    const connection = new Map<string, unknown>([
      ['last_sync_was_error', false],
      ['last_refreshed', '2026-01-01'],
    ]);

    expect(getConnectionStatus(connection, false)).toStrictEqual({
      status: 'connected',
      lastSynced: '2026-01-01',
    });
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

  it('shows the error and the Fix button when the last sync failed', async () => {
    const item = await db.connection_documents.insert(
      createEpicConnection({ id: 'connection-1', last_sync_was_error: true }),
    );
    render(
      <TestProviders db={db}>
        <MemoryRouter>
          <ConnectionCard item={item} />
        </MemoryRouter>
      </TestProviders>,
    );

    screen.getByText('Unable to sync');
    screen.getByRole('button', { name: 'Fix' });
    expect(
      screen.getByRole('button', { name: 'Disconnect Source' }),
    ).toHaveProperty('disabled', false);
  });

  it('shows the running sync instead of the previous error', async () => {
    mockSyncJobs = { 'connection-1': {} };
    const item = await db.connection_documents.insert(
      createEpicConnection({ id: 'connection-1', last_sync_was_error: true }),
    );
    render(
      <TestProviders db={db}>
        <MemoryRouter>
          <ConnectionCard item={item} />
        </MemoryRouter>
      </TestProviders>,
    );

    screen.getByText('Syncing now...');
    expect(screen.queryByText('Unable to sync')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fix' })).toBeNull();
  });

  it('disables Disconnect Source while the connection syncs', async () => {
    mockSyncJobs = { 'connection-1': {} };
    const item = await db.connection_documents.insert(
      createEpicConnection({ id: 'connection-1' }),
    );
    render(
      <TestProviders db={db}>
        <MemoryRouter>
          <ConnectionCard item={item} />
        </MemoryRouter>
      </TestProviders>,
    );

    expect(
      screen.getByRole('button', { name: 'Disconnect Source' }),
    ).toHaveProperty('disabled', true);
  });

  it('leaves Disconnect Source enabled while another connection syncs', async () => {
    mockSyncJobs = { 'connection-2': {} };
    const item = await db.connection_documents.insert(
      createEpicConnection({ id: 'connection-1' }),
    );
    render(
      <TestProviders db={db}>
        <MemoryRouter>
          <ConnectionCard item={item} />
        </MemoryRouter>
      </TestProviders>,
    );

    expect(
      screen.getByRole('button', { name: 'Disconnect Source' }),
    ).toHaveProperty('disabled', false);
  });

  it('disables Remove when a sync starts while the confirm dialog is open', async () => {
    const item = await db.connection_documents.insert(
      createEpicConnection({ id: 'connection-1' }),
    );
    const view = render(
      <TestProviders db={db}>
        <MemoryRouter>
          <ConnectionCard item={item} />
        </MemoryRouter>
      </TestProviders>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Source' }));
    const remove = await screen.findByRole('button', { name: 'Remove' });
    expect(remove).toHaveProperty('disabled', false);

    mockSyncJobs = { 'connection-1': {} };
    view.rerender(
      <TestProviders db={db}>
        <MemoryRouter>
          <ConnectionCard item={item} />
        </MemoryRouter>
      </TestProviders>,
    );

    expect(remove).toHaveProperty('disabled', true);
  });
});
