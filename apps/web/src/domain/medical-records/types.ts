import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource } from 'fhir/r2';

export interface DocumentText {
  id: string;
  text: string;
  sourceDocId: string;
  resourceType?: string;
  date?: string;
  metadata?: {
    chunkId?: string;
    sectionType?: string;
    offset?: number;
    size?: number;
    relevanceScore?: number;
  };
}

export interface RankedDocument {
  document: DocumentText;
  relevanceScore: number;
  relevanceReason: string;
}

export interface DocumentSearchResult {
  documents: ClinicalDocument<BundleEntry<FhirResource>>[];
  relevantChunkIds: string[];
  searchTerms: string[];
  confidence: number;
}

export interface PreparedDocuments {
  texts: DocumentText[];
  sourceDocs: ClinicalDocument<BundleEntry<FhirResource>>[];
  totalCount: number;
}
