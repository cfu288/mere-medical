import { RxCollection } from 'rxdb';
import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
} from 'rxdb';
import { instanceConfigSchemaLiteral } from './InstanceConfig.schema';

export const instanceConfigSchemaTyped = toTypedRxJsonSchema(
  instanceConfigSchemaLiteral,
);

type InstanceConfigDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof instanceConfigSchemaTyped
>;

export const InstanceConfigDocumentSchema: RxJsonSchema<InstanceConfigDocumentType> =
  instanceConfigSchemaLiteral;

export type InstanceConfigDocumentCollection =
  RxCollection<InstanceConfigDocumentType>;
