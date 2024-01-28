import { RxCollection } from 'rxdb';
import { RxJsonSchema } from 'rxdb';
import { vectorStorageSchemaLiteral } from './VectorStorageDocument.schema';
import { VectorStorageDocument } from './VectorStorageDocument.type';

export const VectorStorageDocumentSchema: RxJsonSchema<VectorStorageDocument> =
  vectorStorageSchemaLiteral;

export type VectorStorageDocumentCollection =
  RxCollection<VectorStorageDocument>;
