import React from 'react';
import { VectorStorageContext } from '../providers/VectorStorageProvider';

/**
 * Hook that returns the VectorStorage instance from the VectorStorageProvider
 * @returns
 */
export function useVectors() {
  const context = React.useContext(VectorStorageContext);
  // if (context === undefined) {
  //   throw new Error(
  //     'useVectorStorage must be used within a VectorStorageProvider',
  //   );
  // }
  return context;
}
