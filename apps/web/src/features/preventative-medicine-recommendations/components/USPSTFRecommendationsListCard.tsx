import { useRxDb } from '../../../components/providers/RxDbProvider';
import { useEffect, useRef } from 'react';
import { useUser } from '../../../components/providers/UserProvider';
import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import React from 'react';
import { useLocalConfig } from '../../../components/providers/LocalConfigProvider';
import { useVectors } from '../../../components/providers/vector-provider';
import { USPSTFRecommendationDocument } from '../../../models/uspstf-recommendation-document/USPSTFRecommendationDocument.type';
import { useVectorSyncStatus } from '../../../components/providers/vector-provider/providers/VectorGeneratorSyncInitializer';
import { RecommendationCard } from './RecommendationCard';
import { USPSTFRecommendationsGenerator } from 'apps/web/src/features/preventative-medicine-recommendations/services/USPSTFRecommendationsGenerator';

export const USPSTFRecommendationsListCard =
  function USPSTFRecommendationsListCard() {
    const user = useUser(),
      db = useRxDb(),
      vectorStorage = useVectors();
    const { experimental__openai_api_key, experimental__use_openai_rag } =
      useLocalConfig();
    const [recommendations, setRecommendations] = React.useState<
      USPSTFRecommendationDocument[]
    >([]);
    const recommendationGenerator = useRef<USPSTFRecommendationsGenerator>();
    const vsSyncStatus = useVectorSyncStatus();

    useEffect(() => {
      // subscribe to rxdb collection for recommendations
      const sub = db.uspstf_recommendation_documents
        .find()
        .$.subscribe((recs) => {
          setRecommendations(recs);
        });

      return () => {
        sub.unsubscribe();
      };
    }, [db.uspstf_recommendation_documents]);

    useEffect(() => {
      // only run once, if already init then don't run
      if (recommendationGenerator.current) {
        return;
      }

      // Make sure vector generating process is complete before starting recommendation generation
      if (vsSyncStatus === 'COMPLETE') {
        if (user?.birthday) {
          if (
            experimental__use_openai_rag &&
            experimental__openai_api_key &&
            vectorStorage
          ) {
            recommendationGenerator.current =
              new USPSTFRecommendationsGenerator({
                db,
                vectorStorage,
                user,
                enabled: experimental__use_openai_rag,
                openAiKey: experimental__openai_api_key,
              });

            recommendationGenerator.current.startSync();
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

    if (!experimental__use_openai_rag) return null;

    if (recommendations.length === 0) return null;

    return (
      <div className="col-span-6">
        <Disclosure defaultOpen={true}>
          {({ open }) => (
            <>
              <Disclosure.Button className="w-full font-bold">
                <div className="flex w-full items-center justify-between py-6 text-xl font-extrabold">
                  Mere Assistant Suggestions
                  <ChevronDownIcon
                    className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${open ? 'rotate-180 transform' : ''}`}
                  />
                </div>
              </Disclosure.Button>
              <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
              >
                <Disclosure.Panel>
                  <div className="flex overflow-x-auto pb-4 space-x-4 px-4">
                    {recommendations.map((rec) => (
                      <RecommendationCard recommendation={rec} key={rec.id} />
                    ))}
                  </div>
                </Disclosure.Panel>
              </Transition>
            </>
          )}
        </Disclosure>
      </div>
    );
  };
