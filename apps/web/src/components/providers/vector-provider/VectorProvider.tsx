import React from 'react';
import { VectorStorageProvider } from './providers/VectorStorageProvider';
import { VectorGeneratorSyncInitializer } from './providers/VectorGeneratorSyncInitializer';

/**
 * A provider that initializes the vector storage and initializes the process of generating vectors
 * Accessing the vector storage is done via the useVectors() hook
 * @param param0
 * @returns
 */
export function VectorProvider({ children }: { children: React.ReactNode }) {
  return (
    <VectorStorageProvider>
      <VectorGeneratorSyncInitializer>
        {children}
      </VectorGeneratorSyncInitializer>
    </VectorStorageProvider>
  );
}
