import { BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../components/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { ChatMessage } from '../types/ChatMessage';
import { prepareDataForOpenAI } from './prepareDataForOpenAI';
import { callOpenAI } from './callOpenAI';
import { fetchRecordsWithVectorSearch } from '../../../pages/TimelineTab';
import { VectorStorage } from '@mere/vector-storage';
import uuid4 from '../../../utils/UUIDUtils';

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
  data?: ClinicalDocument<BundleEntry<FhirResource>>[];
  idsOfMostRelatedChunksFromSemanticSearch?: string[];
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
    let currentDataBatch = data || [];
    let currentidsOfMostRelatedChunksFromSemanticSearch =
      idsOfMostRelatedChunksFromSemanticSearch || [];
    let currentIteration = 0;
    let canContinueToSearch = true;

    while (canContinueToSearch) {
      currentIteration++;
      canContinueToSearch = currentIteration <= 10 ? true : false;
      preparedData = [
        ...preparedData,
        ...(currentDataBatch.length === 0
          ? []
          : await prepareDataForOpenAI({
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

        if (
          (functionCall?.args as unknown as { queries: string[] })?.queries &&
          Array.isArray(
            (functionCall?.args as unknown as { queries: string[] })?.queries,
          )
        ) {
          const searchTerms = (functionCall?.args as { queries: string[] })
            ?.queries;
          console.debug(
            'Mere Assistant is running an additional query to find more records using the following search terms: ',
            searchTerms.join(', '),
          );
          for (const searchTerm of searchTerms) {
            const result = await fetchRecordsWithVectorSearch({
              db,
              vectorStorage,
              query: searchTerm,
              numResults: 5,
              enableSearchAttachments: true,
              groupByDate: false,
            });

            currentDataBatch = [
              ...currentDataBatch,
              ...Object.values(result.records).flat(),
            ];
            currentidsOfMostRelatedChunksFromSemanticSearch = [
              ...currentidsOfMostRelatedChunksFromSemanticSearch,
              ...result.idsOfMostRelatedChunksFromSemanticSearch,
            ];
            recentSearches = [
              ...recentSearches,
              // not displated to user, but used for AI to understand the context
              {
                user: 'AI',
                text: `I've run an additional query ${currentIteration} time(s) with search term ${searchTerm} and found ${currentDataBatch.length} records using query: ${searchTerm}. I will now search through them.`,
                timestamp: new Date(),
                id: uuid4(),
              },
            ];
            currentIteration++;
          }
        }
        // else if ((functionCall?.args as { query: string })?.['query']) {
        //   const result = await fetchRecordsWithVectorSearch({
        //     db,
        //     vectorStorage,
        //     query: (functionCall?.args as unknown as { query: string })?.[
        //       'query'
        //     ],
        //     numResults: 5,
        //     enableSearchAttachments: true,
        //     groupByDate: false,
        //   });

        //   currentDataBatch = [...Object.values(result.records).flat()];
        //   currentidsOfMostRelatedChunksFromSemanticSearch = [
        //     ...result.idsOfMostRelatedChunksFromSemanticSearch,
        //   ];
        //   recentSearches = [
        //     ...recentSearches,
        //     // not displated to user, but used for AI to understand the context
        //     {
        //       user: 'AI',
        //       text: `I've run an additional query ${currentIteration} time(s) and found ${currentDataBatch.length} records using query: ${(functionCall?.args as { query: string })?.['query']}. I will now search through them.`,
        //       timestamp: new Date(),
        //       id: uuid4(),
        //     },
        //   ];
        // }
      }
    }
    return Promise.resolve();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
