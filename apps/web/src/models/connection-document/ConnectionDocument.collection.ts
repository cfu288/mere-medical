import { RxCollection, RxJsonSchema } from 'rxdb';
import { connectionSchemaLiteral } from './ConnectionDocument.schema';
import { ConnectionDocument } from './ConnectionDocument.type';

export const ConnectionDocumentSchema: RxJsonSchema<ConnectionDocument> =
  connectionSchemaLiteral;

export type ConnectionDocumentCollection = RxCollection<ConnectionDocument>;
