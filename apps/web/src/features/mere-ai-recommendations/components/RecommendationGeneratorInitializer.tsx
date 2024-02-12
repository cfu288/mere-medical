import React, { useEffect, useRef } from 'react';
import { useLocalConfig } from '../../../components/providers/LocalConfigProvider';
import { useRxDb } from '../../../components/providers/RxDbProvider';
import { useUser } from '../../../components/providers/UserProvider';
import { useVectors } from '../../../components/providers/vector-provider';
import { useVectorSyncStatus } from '../../../components/providers/vector-provider/providers/VectorGeneratorSyncInitializer';
import { USPSTFRecommendationsGenerator } from '../services/USPSTFRecommendationsGenerator';

type RecommendationGeneratorSyncStatus =
  | 'IDLE'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'ERROR';

const RecommendationGeneratorSyncStatusContext =
  React.createContext<RecommendationGeneratorSyncStatus>('IDLE');

export function useRecommendationGeneratorSyncStatus() {
  const context = React.useContext(RecommendationGeneratorSyncStatusContext);
  if (context === undefined) {
    throw new Error(
      'useRecommendationGeneratorSyncStatus must be used within a RecommendationGeneratorProvider',
    );
  }
  return context;
}

export function RecommendationGeneratorInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useUser();
  const db = useRxDb();
  const vectorStorage = useVectors();
  const { experimental__openai_api_key, experimental__use_openai_rag } =
    useLocalConfig();
  const recommendationGenerator = useRef<USPSTFRecommendationsGenerator>();
  const vsSyncStatus = useVectorSyncStatus();
  const [status, setStatus] =
    React.useState<RecommendationGeneratorSyncStatus>('IDLE');

  useEffect(() => {
    // only run once, if already init then don't run
    if (recommendationGenerator.current) {
      return;
    }

    // Make sure vector generating process is complete before starting recommendation generation
    if (vsSyncStatus === 'COMPLETE') {
      // TODO: add more complete check for user
      if (user?.birthday) {
        if (
          experimental__use_openai_rag &&
          experimental__openai_api_key &&
          vectorStorage
        ) {
          setStatus('IN_PROGRESS');
          recommendationGenerator.current = new USPSTFRecommendationsGenerator({
            db,
            vectorStorage,
            user,
            enabled: experimental__use_openai_rag,
            openAiKey: experimental__openai_api_key,
          });

          recommendationGenerator.current
            .startSync()
            .then(() => {
              setStatus('COMPLETE');
            })
            .catch((e) => {
              console.error(e);
              setStatus('ERROR');
            });
        }
      }
    }
  }, [
    db,
    experimental__openai_api_key,
    experimental__use_openai_rag,
    user,
    user?.birthday,
    vectorStorage,
    vsSyncStatus,
  ]);

  return (
    <RecommendationGeneratorSyncStatusContext.Provider value={status}>
      {children}
    </RecommendationGeneratorSyncStatusContext.Provider>
  );
}
