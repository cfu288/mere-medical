import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { differenceInDays, parseISO } from 'date-fns';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { fetchRecordsWithVectorSearch } from '../../timeline/TimelineTab';
import { VectorStorage } from '@mere/vector-storage';
import { DocumentPreparer } from '../../ai-chat/services/document-preparer';
import {
  USPSTFRecommendationDataItem,
  USPSTFRecommendationDocument,
} from '../../../models/uspstf-recommendation-document/USPSTFRecommendationDocument.type';

export const askOpenAIAboutUSPSTF = async ({
  openAiKey,
  user,
  db,
  vectorStorage,
  recommendationList,
  streamingCallback,
}: {
  openAiKey?: string;
  user: UserDocument;
  db: RxDatabase<DatabaseCollections>;
  vectorStorage: VectorStorage<any>;
  recommendationList: USPSTFRecommendationDataItem[];

  streamingCallback?: (rec: USPSTFRecommendationDocument) => void;
}): Promise<USPSTFRecommendationDocument[]> => {
  const resArr: USPSTFRecommendationDocument[] = [];
  for (const rec of recommendationList) {
    const rawData = await fetchRecordsWithVectorSearch({
      db,
      vectorStorage,
      query: rec.description + rec.appliesTo,
      numResults: 5,
      enableSearchAttachments: true,
      groupByDate: false,
    });

    const records: ClinicalDocument<BundleEntry<FhirResource>>[] = [
      ...Object.values(rawData.records).flat(),
    ];
    const idsOfMostRelatedChunksFromSemanticSearch = [
      ...rawData.idsOfMostRelatedChunksFromSemanticSearch,
    ];

    if (rec.searchTerms) {
      for (const term of rec.searchTerms) {
        const searchTermsRawData = await fetchRecordsWithVectorSearch({
          db,
          vectorStorage,
          query: term,
          numResults: 3,
          enableSearchAttachments: true,
          groupByDate: false,
        });
        records.concat([...Object.values(searchTermsRawData.records).flat()]);
        idsOfMostRelatedChunksFromSemanticSearch.concat(
          searchTermsRawData.idsOfMostRelatedChunksFromSemanticSearch,
        );
      }
    }

    const preparer = new DocumentPreparer({
      documents: records,
      context: {
        db,
        user,
        query: rec.description + rec.appliesTo,
      },
      searchMetadata: {
        relevantChunkIds: idsOfMostRelatedChunksFromSemanticSearch,
        attachmentContentMap: new Map(),
      },
      aiConfig: {
        aiProvider: 'openai',
        openAiKey,
      },
      options: {
        enableReranking: false,
      },
    });

    const preparedResult = await preparer
      .extractTexts()
      .then((p) => p.deduplicate())
      .then((p) => p.build());

    const preparedData = preparedResult.texts;

    const promptMessages = [
      {
        role: 'system',
        content:
          'You are a medical AI assistant. You are given a USPSTF recommendation. Given a patient’s demographic information and provided medical records, determine if the patient is eligible for the recommendation. Return JSON as with the following format: { "recommendation": "You are eligible for a ...", "eligible": true } or { "recommendation": "It is recommended that you get a ...", "eligible": true } or { "recommendation": "You have already received a ...", "eligible": false }. Your recommendation should address the patient directly.',
      },
      {
        role: 'system',
        content: `USPSTF Recommendation to check: ${JSON.stringify(rec)}`,
      },
      {
        role: 'system',
        content: `Subset of medical records the patient has already gotten you found that may be relevant. If the patient already has results that satisfy the recommendation, do not suggest the recommendation.
    Data: ${JSON.stringify(preparedData, null, 2)}`,
      },
      {
        role: 'user',
        content: `Do I meet the criteria for the recommendation ${user?.birthday && 'as a ' + (differenceInDays(new Date(), parseISO(user?.birthday)) / 365)?.toFixed(1) + ' year old '} ${user?.gender ? user.gender : ''}?`,
      },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview', // TODO: Use configurable model when re-enabling USPSTF feature
        messages: promptMessages,
        response_format: { type: 'json_object' },
      }),
    });
    try {
      const res = await response.json();
      const item = JSON.parse(res.choices[0].message.content) as {
        recommendation: string;
        eligible: boolean;
      };
      const {
        appliesTo,
        howToImplement,
        searchTerms,
        minAge,
        maxAge,
        grade,
        releaseDateOfCurrentRecommendation,
        ...restOfRec
      } = rec;
      const newRec: USPSTFRecommendationDocument = {
        ...restOfRec,
        ...item,
        lastModified: new Date().toISOString(),
      };
      resArr.push(newRec);
      if (streamingCallback) {
        streamingCallback(newRec);
      }
    } catch (e) {
      console.error('Unable to parse response from OpenAI');
      console.error(e);
    }
  }
  return resArr;
};
