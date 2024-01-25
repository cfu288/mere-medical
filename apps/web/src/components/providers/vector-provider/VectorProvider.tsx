import React from 'react';
import { VectorStorageProvider } from './providers/VectorStorageProvider';
import { VectorGeneratorSyncInitializer } from './providers/VectorGeneratorSyncInitializer';

export function VectorProvider({ children }: { children: React.ReactNode }) {
  return (
    <VectorStorageProvider>
      <VectorGeneratorSyncInitializer>
        {children}
      </VectorGeneratorSyncInitializer>
    </VectorStorageProvider>
  );
}
