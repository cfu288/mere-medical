import React, { PropsWithChildren } from 'react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { RxDbContext } from '../components/providers/RxDbProvider';

interface TestProvidersProps extends PropsWithChildren {
  db: RxDatabase<DatabaseCollections>;
}

/**
 * Wrapper component that provides the RxDB database context for testing.
 * This allows components that depend on useRxDb() to work in tests.
 */
export function TestProviders({ db, children }: TestProvidersProps) {
  return <RxDbContext.Provider value={db}>{children}</RxDbContext.Provider>;
}
