import React, { useEffect, useRef } from 'react';
import { useRxDb } from '../../RxDbProvider';
import { VectorGeneratorSyncer } from './VectorGeneratorSyncer';
import { useVectors } from '..';

/**
 * A component that starts the process of generating vectors from clinical documents
 * and storing the resulting vectors in the database. Essentally wraps VectorGeneratorSyncer
 * and calls startSync() on it.
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

  useEffect(() => {
    if (vectorStorage && rxdb && !vsSync.current) {
      vsSync.current = new VectorGeneratorSyncer(rxdb, vectorStorage);
      vsSync.current.startSync();
    }
  }, [rxdb, vectorStorage]);

  return <>{children}</>;
}
