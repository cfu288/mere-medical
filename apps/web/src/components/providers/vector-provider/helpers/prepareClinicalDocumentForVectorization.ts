import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { flattenObject } from '../../../../utils/flattenObject';
import { DocMeta } from '../providers/VectorStorageProvider';
import { MAX_CHARS, CHUNK_SIZE, CHUNK_OVERLAP } from '../constants';
import { IVSChunkMeta } from '@mere/vector-storage';
import { checkIfXmlIsCCDA } from '../../../timeline/ShowDocumentReferenceResultsExpandable/ShowDocumentReferenceAttachmentExpandable';
import { parseCCDARaw } from '../../../timeline/ShowDocumentReferenceResultsExpandable/parseCCDA/parseCCDA';

/**
 * Generate deterministic, parsable chunk IDs based on document ID and chunk metadata.
 *
 * We intentionally DO NOT use random UUIDs here because:
 * 1. The vector storage deduplication relies on consistent IDs across sessions
 * 2. Random IDs would cause the same chunks to be re-embedded on every app reload
 * 3. Parsable IDs help with debugging and tracking chunks back to their source
 *
 * Format: {documentId}__chunk_{chunkNumber}[__section_{sectionName}]
 * Example: "doc123__chunk_0__section_MEDICATIONS"
 */
function generateChunkId(
  docId: string,
  chunkNumber: number,
  sectionName?: string,
): string {
  let chunkId = `${docId}__chunk_${chunkNumber}`;
  if (sectionName) {
    chunkId += `__section_${sectionName}`;
  }
  return chunkId;
}

/**
 * For each clinical document, prepare the document for vectorization
 *
 * If a document is JSON, flatten the object, take the values only and
 * serialize it to a string. The string is then truncated to MAX_CHARS
 *
 * If the document is XML, it is chunked into chunks of CHUNK_SIZE and each
 * chunk string is vectorized separately. There is an overlap of CHUNK_OVERLAP
 * between each chunk to ensure that information is not lost between chunks.
 *
 * @param document
 * @returns
 */
export function prepareClinicalDocumentForVectorization(
  document: ClinicalDocument<unknown>,
) {
  const docList: {
    id: string;
    text: string;
    chunk?: IVSChunkMeta;
  }[] = [];
  const metaList: DocMeta[] = Array<DocMeta>();
  const docId = document.id;

  // Base metadata that all chunks will share
  const baseMeta: DocMeta = {
    category: document.data_record.resource_type,
    document_type: 'clinical_document',
    id: docId,
    url: document.metadata?.id,
    // Add the document ID to metadata for querying
    documentId: docId,
    user_id: document.user_id,
  };

  if (
    document.data_record.content_type === 'application/json' &&
    (document.data_record.format === 'FHIR.DSTU2' ||
      document.data_record.format === 'FHIR.R4')
  ) {
    serializeAndChunkJSONForVectorization(
      document.data_record.raw,
      baseMeta,
      docList,
      metaList,
    );
  } else if (
    document.data_record.content_type === 'application/xml' &&
    checkIfXmlIsCCDA(document.data_record.raw as string)
  ) {
    serializeCCDADocumentForVectorization(
      document.data_record.raw as string,
      baseMeta,
      docList,
      metaList,
    );
  } else if (document.data_record.content_type === 'application/xml') {
    serializeAndChunkXmlContentForVectorization({
      content: document.data_record.raw as string,
      meta: baseMeta,
      chunkedDocumentsList: docList,
      chunkedMetadataList: metaList,
    });
  }

  return { docList, metaList };
}

/**
 * Serializes a FHIR document for vector storage by:
 * 1. Removing unnecessary metadata fields
 * 2. Flattening the nested structure
 * 3. Extracting unique values and joining with pipe delimiter
 *
 * The goal is to create a concise text representation
 *
 * @param data - The FHIR document data
 * @param meta - Document metadata
 * @returns Object containing serialized text and metadata
 */
export function serializeFHIRDocumentForVectorStorage(
  data: any,
  meta: DocMeta,
): {
  id: string;
  text: string;
  metadata: DocMeta;
} {
  // Deep clone to avoid mutating original
  const cleanedDoc: any = JSON.parse(JSON.stringify(data));

  // Remove FHIR wrapper fields
  delete cleanedDoc.link;
  delete cleanedDoc.fullUrl;
  delete cleanedDoc.search;

  // Remove unnecessary resource fields
  if (cleanedDoc.resource) {
    delete cleanedDoc.resource.category;
    delete cleanedDoc.resource.subject;
    delete cleanedDoc.resource.id;
    delete cleanedDoc.resource.status;
    delete cleanedDoc.resource.identifier;
  }

  // Sort keys for consistent output
  const sortedDoc = Object.keys(cleanedDoc)
    .sort()
    .reduce((obj: any, key: any) => {
      obj[key] = cleanedDoc[key];
      return obj;
    }, {});

  // Flatten nested structure
  const flattened = flattenObject(sortedDoc);

  // Extract unique values and serialize
  const serialized = [...new Set(Object.values(flattened))]
    .join('|')
    .substring(0, MAX_CHARS);

  return {
    id: generateChunkId(meta.documentId || meta.id, 0),
    text: serialized,
    metadata: {
      ...meta,
      chunkNumber: 0,
      isFullDocument: false,
    },
  };
}

function serializeAndChunkJSONForVectorization(
  data: any,
  meta: DocMeta,
  docList: {
    id: string;
    text: string;
    chunk?: IVSChunkMeta;
  }[],
  metaList: DocMeta[],
) {
  const result = serializeFHIRDocumentForVectorStorage(data, meta);

  docList.push({
    id: result.id,
    text: result.text,
  });

  metaList.push(result.metadata);
}

/**
 * Chunk XML content into chunks of CHUNK_SIZE
 *
 * @param content the XML content
 * @param meta the metadata for the document
 * @param chunkedDocumentsList list that chunks are added to
 * @param chunkedMetadataList list that metadata chunks are added to
 * @param prependText text to prepend to each chunk
 * @param sectionName the section name for CCDA documents
 * @param isFullDocument whether this is the full document
 */
function serializeAndChunkXmlContentForVectorization({
  content,
  meta,
  chunkedDocumentsList,
  chunkedMetadataList,
  prependText = '',
  sectionName,
  isFullDocument = false,
}: {
  content: string;
  meta: DocMeta;
  chunkedDocumentsList: {
    id: string;
    text: string;
    chunk?: IVSChunkMeta;
  }[];
  chunkedMetadataList: DocMeta[];
  prependText?: string;
  sectionName?: string;
  isFullDocument?: boolean;
}) {
  if (content.length > CHUNK_SIZE) {
    for (
      let offset = 0, chunkNumber = 0;
      offset < content.length;
      offset += CHUNK_SIZE - CHUNK_OVERLAP, chunkNumber++
    ) {
      const chunkData = content.substring(
        offset,
        Math.min(offset + CHUNK_SIZE, content.length),
      );
      chunkedDocumentsList.push({
        id: generateChunkId(
          meta.documentId || meta.id,
          chunkNumber,
          sectionName,
        ),
        text: prependText + chunkData,
        chunk: {
          offset: offset,
          size: chunkData.length,
        },
      });
      chunkedMetadataList.push({
        ...meta,
        sectionName: sectionName || undefined,
        chunkNumber,
        isFullDocument,
      });
    }
  } else {
    chunkedDocumentsList.push({
      id: generateChunkId(meta.documentId || meta.id, 0, sectionName),
      text: prependText + (content || '').trim(),
    });
    chunkedMetadataList.push({
      ...meta,
      sectionName: sectionName || undefined,
      chunkNumber: 0,
      isFullDocument,
    });
  }
}

function serializeCCDADocumentForVectorization(
  content: string,
  meta: DocMeta,
  docList: {
    id: string;
    text: string;
    chunk?: IVSChunkMeta;
  }[],
  metaList: DocMeta[],
) {
  const parsed = parseCCDARaw(content);

  const allSections = Object.entries(parsed)
    .filter(([_, data]) => data)
    .map(([sectionType, data]) => `${sectionType}|${data}`)
    .join('\n\n');

  if (allSections) {
    serializeAndChunkXmlContentForVectorization({
      content: allSections,
      meta,
      chunkedDocumentsList: docList,
      chunkedMetadataList: metaList,
      prependText: 'FULL_DOCUMENT|',
      isFullDocument: true,
    });
  }

  Object.entries(parsed).forEach(([sectionType, data]) => {
    if (data) {
      serializeAndChunkXmlContentForVectorization({
        content: data,
        meta,
        chunkedDocumentsList: docList,
        chunkedMetadataList: metaList,
        prependText: sectionType + '|',
        sectionName: sectionType,
      });
    }
  });
}
