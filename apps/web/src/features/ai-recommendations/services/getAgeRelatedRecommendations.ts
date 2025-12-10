import { USPSTFRecommendationDataItem } from '../../../models/uspstf-recommendation-document/USPSTFRecommendationDocument.type';
import data from '../data/USPSTF_A&B_Recommendations.json';

export const USPSTFRecommendations = data as USPSTFRecommendationDataItem[];

export function getUSPSTFRecommendationsByAge(
  age: number,
): USPSTFRecommendationDataItem[] {
  return USPSTFRecommendations.filter(
    (recommendation: USPSTFRecommendationDataItem) =>
      (recommendation.minAge === undefined || age >= recommendation.minAge) &&
      (recommendation.maxAge === undefined || age <= recommendation.maxAge),
  );
}
