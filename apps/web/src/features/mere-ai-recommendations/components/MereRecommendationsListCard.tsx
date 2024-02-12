import React, { useEffect } from 'react';

import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

import { useLocalConfig } from '../../../components/providers/LocalConfigProvider';
import { useRxDb } from '../../../components/providers/RxDbProvider';
import { USPSTFRecommendationDocument } from '../../../models/uspstf-recommendation-document/USPSTFRecommendationDocument.type';
import {
  RecommendationCard,
  SkeletonRecommendationCard,
} from './RecommendationCard';
import { useRecommendationGeneratorSyncStatus } from './RecommendationGeneratorInitializer';

function useRecommendations() {
  const db = useRxDb();
  const [recommendations, setRecommendations] = React.useState<
    USPSTFRecommendationDocument[]
  >([]);

  useEffect(() => {
    const sub = db.uspstf_recommendation_documents
      .find()
      .$.subscribe((recs) => {
        setRecommendations(recs);
      });

    return () => {
      sub.unsubscribe();
    };
  }, [db.uspstf_recommendation_documents]);

  return recommendations;
}

export const MereRecommendationsListCard =
  function MereRecommendationsListCard() {
    const { experimental__use_openai_rag } = useLocalConfig();
    const recommendations = useRecommendations();
    const status = useRecommendationGeneratorSyncStatus();

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
                  <div className="flex overflow-x-auto gap-4 flex-nowrap">
                    {recommendations.map((rec) => (
                      <RecommendationCard recommendation={rec} key={rec.id} />
                    ))}
                    {status === 'IN_PROGRESS' && <SkeletonRecommendationCard />}
                  </div>
                </Disclosure.Panel>
              </Transition>
            </>
          )}
        </Disclosure>
      </div>
    );
  };
