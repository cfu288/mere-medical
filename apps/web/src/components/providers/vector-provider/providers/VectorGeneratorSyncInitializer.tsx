import React, { useEffect, useRef } from 'react';
import { useRxDb } from '../../RxDbProvider';
import { useUser } from '../../UserProvider';
import { VectorGeneratorSyncer } from './VectorGeneratorSyncer';
import { useVectors } from '..';

type VectorSyncStatus = 'IDLE' | 'IN_PROGRESS' | 'COMPLETE' | 'ERROR';

const VectorSyncStatusContext = React.createContext<VectorSyncStatus>('IDLE');

/**
 * Hook to access the sync status state from the VectorSyncContext.
 */
export function useVectorSyncStatus() {
  const context = React.useContext(VectorSyncStatusContext);
  if (context === undefined) {
    throw new Error('useVectorSync must be used within a VectorSyncProvider');
  }
  return context;
}

/**
 * A component that starts the process of generating vectors from clinical documents
 * and storing the resulting vectors in the database. Essentially wraps VectorGeneratorSyncer
 * and calls startSync() on it. It also provides a context for children to access the isDone state.
 * @param param0
 * @returns
 */
export function VectorGeneratorSyncInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const vectorStorage = useVectors();
  const rxdb = useRxDb();
  const user = useUser();
  const vsSync = useRef<VectorGeneratorSyncer>();
  const lastSyncedUserId = useRef<string>();
  const [isDone, setIsDone] = React.useState<VectorSyncStatus>('IDLE');

  useEffect(() => {
    if (vectorStorage && rxdb && user?.id) {
      if (lastSyncedUserId.current !== user.id) {
        console.debug(`VectorGeneratorSyncInitializer: User switched from ${lastSyncedUserId.current} to ${user.id}, starting vector sync`);

        if (vsSync.current) {
          vsSync.current = undefined;
        }

        vsSync.current = new VectorGeneratorSyncer(rxdb, vectorStorage);
        setIsDone('IN_PROGRESS');
        lastSyncedUserId.current = user.id;

        vsSync.current
          .startSync()
          .then(() => {
            setIsDone('COMPLETE');
          })
          .catch((e) => {
            console.error('Vector sync error:', e);
            setIsDone('ERROR');
            lastSyncedUserId.current = undefined;
          });
      }
    }
  }, [rxdb, vectorStorage, user?.id]);

  return (
    <VectorSyncStatusContext.Provider value={isDone}>
      {children}
    </VectorSyncStatusContext.Provider>
  );
}
