import { RxCollection } from 'rxdb';
import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
} from 'rxdb';
import { clinicalDocumentSchemaLiteral } from './ClinicalDocumentSchema';

const clinicalDocumentSchemaTyped = toTypedRxJsonSchema(
  clinicalDocumentSchemaLiteral
);

export type ClinicalDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof clinicalDocumentSchemaTyped
>;

export const ClinicalDocumentSchema: RxJsonSchema<ClinicalDocumentType> =
  clinicalDocumentSchemaLiteral;

export type ClinicalDocumentCollection = RxCollection<ClinicalDocumentType>;
