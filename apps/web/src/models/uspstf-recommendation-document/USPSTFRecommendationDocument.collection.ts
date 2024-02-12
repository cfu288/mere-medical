import { RxCollection } from 'rxdb';
import { RxJsonSchema } from 'rxdb';
import { USPSTFRecommendationSchemaLiteral } from './USPSTFRecommendationDocument.schema';
import { USPSTFRecommendationDocument } from './USPSTFRecommendationDocument.type';

export const USPSTFRecommendationDocumentSchema: RxJsonSchema<USPSTFRecommendationDocument> =
  USPSTFRecommendationSchemaLiteral;

export type USPSTFRecommendationDocumentCollection =
  RxCollection<USPSTFRecommendationDocument>;
