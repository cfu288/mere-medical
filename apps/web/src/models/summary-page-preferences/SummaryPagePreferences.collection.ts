import { RxJsonSchema, RxCollection } from 'rxdb';
import { summaryPageSchemaLiteral } from './SummaryPagePreferences.schema';
import { SummaryPagePreferences } from './SummaryPagePreferences.type';

export const SummaryPagePreferencesSchema: RxJsonSchema<SummaryPagePreferences> =
  summaryPageSchemaLiteral;

export type SummaryPagePreferencesCollection =
  RxCollection<SummaryPagePreferences>;
