import { RxCollection, RxJsonSchema } from 'rxdb';
import { clinicalDocumentSchemaLiteral } from './ClinicalDocument.schema';
import { ClinicalDocument } from './ClinicalDocument.type';

export const ClinicalDocumentSchema: RxJsonSchema<ClinicalDocument> =
  clinicalDocumentSchemaLiteral;

export type ClinicalDocumentCollection = RxCollection<ClinicalDocument>;
