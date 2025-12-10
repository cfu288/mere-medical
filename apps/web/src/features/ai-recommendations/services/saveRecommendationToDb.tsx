import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { RxDatabase } from 'rxdb';
import { USPSTFRecommendationDocument } from '../../../models/uspstf-recommendation-document/USPSTFRecommendationDocument.type';

export function saveRecommendationToDb(
  db: RxDatabase<DatabaseCollections>,
  recommendation: USPSTFRecommendationDocument,
) {
  return db.uspstf_recommendation_documents
    .upsert({ ...recommendation, lastModified: new Date().toISOString() })
    .then((res) => {
      return res;
    });
}
