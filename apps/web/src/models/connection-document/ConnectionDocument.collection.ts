import { RxCollection } from 'rxdb';
import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
} from 'rxdb';
import { connectionSchemaLiteral } from './ConnectionDocument.schema';

const connectionSchemaTyped = toTypedRxJsonSchema(connectionSchemaLiteral);

type ConnectionDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof connectionSchemaTyped
>;

export const ConnectionDocumentSchema: RxJsonSchema<ConnectionDocumentType> =
  connectionSchemaLiteral;

export type ConnectionDocumentCollection = RxCollection<ConnectionDocumentType>;
