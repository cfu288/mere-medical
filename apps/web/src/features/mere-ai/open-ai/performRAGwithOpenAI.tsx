import { BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../components/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { ChatMessage } from '../../../features/mere-ai/types/ChatMessage';
import { prepareDataForOpenAI } from '../../../features/mere-ai/open-ai/prepareDataForOpenAI';
import { callOpenAI } from '../../../features/mere-ai/open-ai/callOpenAI';

export const performRAGwithOpenAI = async ({
  query,
  data,
  idsOfMostRelatedChunksFromSemanticSearch,
  streamingCallback,
  messages = [],
  openAiKey,
  db,
  user,
}: {
  query: string;
  data: ClinicalDocument<BundleEntry<FhirResource>>[];
  idsOfMostRelatedChunksFromSemanticSearch: string[];
  streamingCallback?: (message: string) => void;
  messages: ChatMessage[];
  openAiKey?: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) => {
  try {
    if (data) {
      const preparedData = await prepareDataForOpenAI({
        data,
        db,
        user,
        idsOfMostRelatedChunksFromSemanticSearch,
      });
      const responseText = await callOpenAI({
        query,
        messages,
        openAiKey,
        preparedData,
        streamingCallback,
        user,
      });
      return Promise.resolve(responseText);
    }
    return Promise.resolve();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
