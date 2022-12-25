import { BaseDocument } from './BaseDocument';

export interface ClinicalDocument<T = any> extends BaseDocument {
  source_record: string;
  data_record: {
    raw: T;
    format: 'FHIR.DSTU2';
    content_type: 'application/json' | 'application/xml' | string;
    resource_type:
      | 'immunization'
      | 'procedure'
      | 'condition'
      | 'observation'
      | 'diagnosticreport'
      | 'medicationstatement'
      | 'patient'
      | 'allergyintolerance'
      | 'practitioner'
      | 'documentreference'
      | 'documentreference_attachment'
      | 'careplan';
    version_history: T[];
  };
  metadata?: {
    id?: string;
    date?: string;
    display_name?: string;
  };
}

export interface MergeClinicalDocument<T> extends ClinicalDocument {
  data_items?: T[];
}
