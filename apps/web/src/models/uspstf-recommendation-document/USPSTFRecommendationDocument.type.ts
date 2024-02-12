import { BaseDocument } from '../BaseDocument';

export interface USPSTFRecommendationDocument
  extends BaseDocument,
    Omit<
      USPSTFRecommendationDataItem,
      | 'appliesTo'
      | 'howToImplement'
      | 'minAge'
      | 'maxAge'
      | 'searchTerms'
      | 'grade'
      | 'releaseDateOfCurrentRecommendation'
    > {
  topic: string;
  description: string;
  url?: string;
  recommendation?: string;
  eligible?: boolean;
  lastModified: string;
}

export interface USPSTFRecommendationDataItem {
  id: string;
  topic: string;
  description: string;
  appliesTo?: string;
  howToImplement?: string;
  grade: 'A' | 'B' | string;
  releaseDateOfCurrentRecommendation: string;
  url?: string;
  minAge?: number;
  maxAge?: number;
  recommendation?: string;
  searchTerms?: string[];
}
