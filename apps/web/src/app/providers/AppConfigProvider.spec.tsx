import { render, waitFor } from '@testing-library/react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from './DatabaseCollections';
import {
  AppConfigProvider,
  useConfig,
  useAppConfig,
  AppConfig,
  ConfigFetcher,
} from './AppConfigProvider';
import { TestProviders } from '../../test-utils/TestProviders';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../../test-utils/createTestDatabase';

describe('AppConfigProvider', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('config fetching', () => {
    it('provides config from successful API fetch', async () => {
      const mockConfig: AppConfig = {
        PUBLIC_URL: 'https://test.example.com',
        EPIC_CLIENT_ID: 'test-epic-client',
      };

      const mockFetcher: ConfigFetcher = async () => mockConfig;

      const TestComponent = () => {
        const config = useConfig();
        return (
          <div>
            <span data-testid="public-url">{config.PUBLIC_URL}</span>
            <span data-testid="epic-client">{config.EPIC_CLIENT_ID}</span>
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <AppConfigProvider configFetcher={mockFetcher}>
            <TestComponent />
          </AppConfigProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('public-url').textContent).toBe(
          'https://test.example.com',
        );
        expect(getByTestId('epic-client').textContent).toBe('test-epic-client');
      });
    });

    it('provides empty config when API fetch fails', async () => {
      const failingFetcher: ConfigFetcher = async () => null;

      const TestComponent = () => {
        const config = useConfig();
        return (
          <div>
            <span data-testid="public-url">{config.PUBLIC_URL || 'empty'}</span>
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <AppConfigProvider configFetcher={failingFetcher}>
            <TestComponent />
          </AppConfigProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('public-url').textContent).toBe('empty');
      });
    });
  });

  describe('stale state', () => {
    it('marks config as not stale after successful fetch', async () => {
      const mockFetcher: ConfigFetcher = async () => ({
        PUBLIC_URL: 'https://test.com',
      });

      const TestComponent = () => {
        const { isStale } = useAppConfig();
        return <span data-testid="is-stale">{String(isStale)}</span>;
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <AppConfigProvider configFetcher={mockFetcher}>
            <TestComponent />
          </AppConfigProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('is-stale').textContent).toBe('false');
      });
    });

    it('marks config as stale when fetch fails', async () => {
      const failingFetcher: ConfigFetcher = async () => null;

      const TestComponent = () => {
        const { isStale } = useAppConfig();
        return <span data-testid="is-stale">{String(isStale)}</span>;
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <AppConfigProvider configFetcher={failingFetcher}>
            <TestComponent />
          </AppConfigProvider>
        </TestProviders>,
      );

      await waitFor(
        () => {
          expect(getByTestId('is-stale').textContent).toBe('true');
        },
        { timeout: 1000 },
      );
    });
  });

  describe('caching', () => {
    it('saves config to RxDB after successful fetch', async () => {
      const mockConfig: AppConfig = {
        PUBLIC_URL: 'https://cached.example.com',
        EPIC_CLIENT_ID: 'cached-epic-client',
      };
      const mockFetcher: ConfigFetcher = async () => mockConfig;

      const TestComponent = () => {
        const config = useConfig();
        return <span data-testid="public-url">{config.PUBLIC_URL}</span>;
      };

      render(
        <TestProviders db={db}>
          <AppConfigProvider configFetcher={mockFetcher}>
            <TestComponent />
          </AppConfigProvider>
        </TestProviders>,
      );

      await waitFor(async () => {
        const cached = await db.instance_config
          .findOne('instance_config')
          .exec();
        expect(cached).toBeTruthy();
        expect(cached?.get('PUBLIC_URL')).toBe('https://cached.example.com');
        expect(cached?.get('EPIC_CLIENT_ID')).toBe('cached-epic-client');
      });
    });

    it('uses cached config when API fails', async () => {
      await db.instance_config.upsert({
        id: 'instance_config',
        PUBLIC_URL: 'https://from-cache.example.com',
        EPIC_CLIENT_ID: 'cached-client',
        updated_at: Date.now(),
      });

      const failingFetcher: ConfigFetcher = async () => null;

      const TestComponent = () => {
        const config = useConfig();
        return (
          <div>
            <span data-testid="public-url">{config.PUBLIC_URL || 'empty'}</span>
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <AppConfigProvider configFetcher={failingFetcher}>
            <TestComponent />
          </AppConfigProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('public-url').textContent).toBe(
          'https://from-cache.example.com',
        );
      });
    });

    it('does not include RxDB metadata fields in returned config', async () => {
      await db.instance_config.upsert({
        id: 'instance_config',
        PUBLIC_URL: 'https://test.com',
        updated_at: Date.now(),
      });

      const failingFetcher: ConfigFetcher = async () => null;

      const TestComponent = () => {
        const config = useConfig();
        return (
          <div>
            <span data-testid="has-id">{String('id' in config)}</span>
            <span data-testid="has-updated-at">
              {String('updated_at' in config)}
            </span>
            <span data-testid="has-rev">{String('_rev' in config)}</span>
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <AppConfigProvider configFetcher={failingFetcher}>
            <TestComponent />
          </AppConfigProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('has-id').textContent).toBe('false');
        expect(getByTestId('has-updated-at').textContent).toBe('false');
        expect(getByTestId('has-rev').textContent).toBe('false');
      });
    });
  });

  describe('stale-while-revalidate', () => {
    it('shows cached config immediately then updates with fresh config', async () => {
      await db.instance_config.upsert({
        id: 'instance_config',
        PUBLIC_URL: 'https://stale.example.com',
        updated_at: Date.now(),
      });

      let fetchCalled = false;
      const delayedFetcher: ConfigFetcher = async () => {
        fetchCalled = true;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { PUBLIC_URL: 'https://fresh.example.com' };
      };

      const values: string[] = [];

      const TestComponent = () => {
        const config = useConfig();
        if (config.PUBLIC_URL && !values.includes(config.PUBLIC_URL)) {
          values.push(config.PUBLIC_URL);
        }
        return <span data-testid="public-url">{config.PUBLIC_URL}</span>;
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <AppConfigProvider configFetcher={delayedFetcher}>
            <TestComponent />
          </AppConfigProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('public-url').textContent).toBe(
          'https://fresh.example.com',
        );
      });

      expect(fetchCalled).toBe(true);
      expect(values).toContain('https://stale.example.com');
      expect(values).toContain('https://fresh.example.com');
    });
  });
});
