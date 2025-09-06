import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { DocumentText } from './types';
import { prepareClinicalDocumentForVectorization } from '../../components/providers/vector-provider/helpers/prepareClinicalDocumentForVectorization';

export function extractTextFromDocument(
  doc: ClinicalDocument<BundleEntry<FhirResource>>,
): DocumentText[] {
  const prepared = prepareClinicalDocumentForVectorization(doc);

  return prepared.docList.map((item, index) => ({
    id: item.id || `${doc.id}_chunk_${index}`,
    text: item.text,
    sourceDocId: doc.id,
    resourceType: doc.data_record?.raw?.resource?.resourceType,
    date: doc.metadata?.date as string | undefined,
    metadata: {
      chunkId: item.id,
      sectionType: item.id?.split('_')?.[item.id.split('_').length - 1],
      offset: item.chunk?.offset ?? index,
      size: item.chunk?.size ?? item.text.length,
    },
  }));
}

export function extractTextsFromDocuments(
  documents: ClinicalDocument<BundleEntry<FhirResource>>[],
): DocumentText[] {
  return documents.flatMap(extractTextFromDocument);
}
