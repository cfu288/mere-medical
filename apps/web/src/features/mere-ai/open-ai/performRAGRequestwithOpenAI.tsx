import { BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../components/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { ChatMessage } from '../types/ChatMessage';
import { prepareDataForOpenAI } from './prepareDataForOpenAI';
import { callOpenAI } from './callOpenAI';
import { fetchRecordsWithVectorSearch } from 'apps/web/src/pages/TimelineTab';
import { VectorStorage } from '@mere/vector-storage';
import uuid4 from 'apps/web/src/utils/UUIDUtils';

export const performRAGRequestwithOpenAI = async ({
  query,
  data,
  idsOfMostRelatedChunksFromSemanticSearch,
  streamingMessageCallback,
  messages = [],
  openAiKey,
  db,
  user,
  vectorStorage,
}: {
  query: string;
  data: ClinicalDocument<BundleEntry<FhirResource>>[];
  idsOfMostRelatedChunksFromSemanticSearch: string[];
  streamingMessageCallback?: (message: string) => void;
  messages: ChatMessage[];
  openAiKey?: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  vectorStorage?: VectorStorage<any>;
}) => {
  try {
    let preparedData: string[] = [];
    let recentSearches: ChatMessage[] = [];
    if (data) {
      let currentDataBatch = data;
      let currentidsOfMostRelatedChunksFromSemanticSearch =
        idsOfMostRelatedChunksFromSemanticSearch;
      let currentIteration = 0;
      while (true) {
        currentIteration++;
        const canContinueToSearch = currentIteration <= 5 ? true : false;
        preparedData = [
          ...preparedData,
          ...(await prepareDataForOpenAI({
            data: currentDataBatch,
            db,
            user,
            idsOfMostRelatedChunksFromSemanticSearch:
              currentidsOfMostRelatedChunksFromSemanticSearch,
          })),
        ];
        const { responseText, functionCall } = await callOpenAI({
          query,
          messages: [...messages, ...recentSearches],
          openAiKey,
          preparedData: [...new Set(preparedData)],
          streamingMessageCallback,
          user,
          functionCall: canContinueToSearch ? 'auto' : 'none',
        });

        if (functionCall?.name === undefined) {
          return Promise.resolve(responseText);
        } else if (functionCall?.name === 'search_medical_records') {
          if (!vectorStorage) {
            throw new Error('vectorStorage is not defined');
          }
          const result = await fetchRecordsWithVectorSearch({
            db,
            vectorStorage,
            query: functionCall?.args?.['query'],
            numResults: 10,
            enableSearchAttachments: true,
            groupByDate: false,
          });

          currentDataBatch = [...Object.values(result.records).flat()];
          currentidsOfMostRelatedChunksFromSemanticSearch = [
            ...result.idsOfMostRelatedChunksFromSemanticSearch,
          ];
          recentSearches = [
            ...recentSearches,
            {
              user: 'AI',
              text: `I've run an additional query ${currentIteration} time(s) and found ${currentDataBatch.length} records using query: ${functionCall?.args?.['query']}. I will now search through them.`,
              timestamp: new Date(),
              id: uuid4(),
            },
          ];
        }
      }
    }
    return Promise.resolve();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
