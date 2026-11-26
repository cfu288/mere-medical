import { BundleEntry, FhirResource } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';

export enum QueryStatus {
  /** The first page is loading. */
  LOADING,
  /** The next page is loading. */
  LOADING_MORE,
  /** There are more records to load. */
  SUCCESS,
  /** The first page failed to load. */
  ERROR,
  /** The next page failed to load. */
  LOAD_MORE_ERROR,
  /** There are no more records to load. */
  COMPLETE_HIDE_LOAD_MORE,
}

export type RecordsByDate = Record<
  string,
  ClinicalDocument<BundleEntry<FhirResource>>[]
>;
