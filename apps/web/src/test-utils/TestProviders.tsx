import { PropsWithChildren } from 'react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import { RxDbContext } from '../app/providers/RxDbProvider';
import { NotificationProvider } from '../app/providers/NotificationProvider';

interface TestProvidersProps extends PropsWithChildren {
  db: RxDatabase<DatabaseCollections>;
}

export function TestProviders({ db, children }: TestProvidersProps) {
  return (
    <NotificationProvider>
      <RxDbContext.Provider value={db}>{children}</RxDbContext.Provider>
    </NotificationProvider>
  );
}
