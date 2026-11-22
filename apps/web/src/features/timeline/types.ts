import { BundleEntry, FhirResource } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';

export enum QueryStatus {
  /** First page of the current query and filters is loading. */
  LOADING,
  /** The next page is loading. The pages already loaded stay shown. */
  LOADING_MORE,
  /** Loaded, and more records exist. */
  SUCCESS,
  /** The first page failed to load. There are no records to show. */
  ERROR,
  /** The next page failed to load. The pages already loaded stay shown. */
  LOAD_MORE_ERROR,
  /** Loaded, and no more records exist. */
  COMPLETE_HIDE_LOAD_MORE,
}

export type RecordsByDate = Record<
  string,
  ClinicalDocument<BundleEntry<FhirResource>>[]
>;
