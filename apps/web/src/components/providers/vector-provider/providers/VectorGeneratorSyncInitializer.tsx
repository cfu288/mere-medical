import React, { useEffect, useRef } from 'react';
import { useRxDb } from '../../RxDbProvider';
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
  const vsSync = useRef<VectorGeneratorSyncer>();
  const [isDone, setIsDone] = React.useState<VectorSyncStatus>('IDLE');

  useEffect(() => {
    if (vectorStorage && rxdb && !vsSync.current) {
      vsSync.current = new VectorGeneratorSyncer(rxdb, vectorStorage);
      setIsDone('IN_PROGRESS');
      vsSync.current
        .startSync()
        .then(() => {
          setIsDone('COMPLETE');
        })
        .catch((e) => {
          console.error(e);
          setIsDone('ERROR');
        });
    }
  }, [rxdb, vectorStorage]);

  return (
    <VectorSyncStatusContext.Provider value={isDone}>
      {children}
    </VectorSyncStatusContext.Provider>
  );
}
