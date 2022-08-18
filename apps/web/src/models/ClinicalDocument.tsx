import { BaseDocument } from './BaseDocument';

export interface ClinicalDocument<T = any> extends BaseDocument {
  source_record: string;
  data_record: {
    raw: T;
    format: 'FHIR.DSTU2';
    content_type: 'application/json';
    resource_type:
      | 'immunization'
      | 'procedure'
      | 'condition'
      | 'observation'
      | 'diagnostic_report'
      | 'medication_statement'
      | 'patient';
    version_history: T[];
  };
  metadata?: {
    id?: string;
    date?: string;
    display_name?: string;
    merge_key?: string;
  };
}

export interface MergeClinicalDocument<T> extends ClinicalDocument {
  data_items?: T[];
}
