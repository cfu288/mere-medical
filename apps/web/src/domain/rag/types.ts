import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource } from 'fhir/r2';

export type RAGResult =
  | {
      status: 'success';
      response: string;
      sources: ClinicalDocument<BundleEntry<FhirResource>>[];
      confidence: number;
    }
  | {
      status: 'partial';
      response: string;
      sources: ClinicalDocument<BundleEntry<FhirResource>>[];
      errors: RAGError[];
    }
  | { status: 'error'; error: RAGError };

export class RAGError extends Error {
  constructor(
    message: string,
    public code:
      | 'AUTH'
      | 'SEARCH'
      | 'AI_PROVIDER'
      | 'INVALID_INPUT'
      | 'NO_DOCUMENTS',
    public recoverable: boolean,
    public cause?: Error,
  ) {
    super(message);
    this.name = 'RAGError';
  }
}

export interface RAGOptions {
  maxDocuments?: number;
  includeRelated?: boolean;
  enableReranking?: boolean;
  confidenceThreshold?: number;
  maxSearchIterations?: number;
}
