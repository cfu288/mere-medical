import { RxCollection, RxJsonSchema } from 'rxdb';
import { connectionSchemaLiteral } from './ConnectionDocument.schema';
import { AnyConnectionDocument } from './ConnectionDocument.type';

export const ConnectionDocumentSchema: RxJsonSchema<AnyConnectionDocument> =
  connectionSchemaLiteral;

export type ConnectionDocumentCollection = RxCollection<AnyConnectionDocument>;
