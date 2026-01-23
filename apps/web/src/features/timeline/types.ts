import { BundleEntry, FhirResource } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';

export enum QueryStatus {
  IDLE,
  LOADING,
  LOADING_MORE,
  SUCCESS,
  ERROR,
  COMPLETE_HIDE_LOAD_MORE,
}

export type RecordsByDate = Record<
  string,
  ClinicalDocument<BundleEntry<FhirResource>>[]
>;
