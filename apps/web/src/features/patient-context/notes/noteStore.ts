import { BundleEntry, DocumentReference, FhirResource } from 'fhir/r2';

import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
} from '../../../models/clinical-document/ClinicalDocument.type';
import { HarnessEvent } from '../harness/events';
import { compareDateInfoDesc, toDateInfo } from '../types';
import { ExtractedNote, extractNoteText } from './extractNoteText';
import { NoteRecord } from './noteRecord';

export function toNoteRecords(
  byType: Map<
    ClinicalDocumentResourceType,
    ClinicalDocument<BundleEntry<FhirResource>>[]
  >,
  emit: (event: HarnessEvent) => void,
): NoteRecord[] {
  const docRefs = byType.get('documentreference') ?? [];
  const attachments = byType.get('documentreference_attachment') ?? [];
  const attachmentsByMetadataId = new Map<
    string,
    ClinicalDocument<BundleEntry<FhirResource>>
  >();
  for (const attachment of attachments) {
    if (attachment.metadata?.id) {
      attachmentsByMetadataId.set(attachment.metadata.id, attachment);
    }
  }

  return docRefs
    .slice()
    .sort(
      (a, b) =>
        compareDateInfoDesc(
          toDateInfo(a.metadata?.date),
          toDateInfo(b.metadata?.date),
        ) || a.id.localeCompare(b.id),
    )
    .map((docRef, index) => {
      const resource = docRef.data_record.raw?.resource as
        | DocumentReference
        | undefined;
      const attachment =
        (resource?.content ?? [])
          .map((content) => content.attachment?.url)
          .filter((url): url is string => Boolean(url))
          .map((url) => attachmentsByMetadataId.get(url))
          .find((stored) => stored !== undefined) ??
        (docRef.metadata?.id
          ? attachmentsByMetadataId.get(`${docRef.metadata.id}/attachment`)
          : undefined);
      return {
        alias: `n${index + 1}`,
        date: toDateInfo(docRef.metadata?.date),
        displayName: docRef.metadata?.display_name ?? 'Clinical note',
        contentType: attachment?.data_record.content_type ?? 'no attachment',
        read: memoizedExtract(docRef.id, attachment, emit),
      };
    });
}

/** Attachment bytes as the extractor wants them: text as is, a pdf as base64. */
async function rawText(
  attachment: ClinicalDocument<BundleEntry<FhirResource>>,
): Promise<string | undefined> {
  const raw = attachment.data_record.raw as unknown;
  if (typeof raw === 'string') {
    return raw;
  }
  if (!(raw instanceof Blob)) {
    return undefined;
  }
  const asPdf = (attachment.data_record.content_type ?? '').includes('pdf');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      resolve(asPdf ? result.slice(result.indexOf(',') + 1) : result);
    };
    if (asPdf) {
      reader.readAsDataURL(raw);
    } else {
      reader.readAsText(raw);
    }
  });
}

function memoizedExtract(
  docId: string,
  attachment: ClinicalDocument<BundleEntry<FhirResource>> | undefined,
  emit: (event: HarnessEvent) => void,
): () => Promise<ExtractedNote> {
  let memo: Promise<ExtractedNote> | undefined;
  return () => (memo ??= extract(docId, attachment, emit));
}

async function extract(
  docId: string,
  attachment: ClinicalDocument<BundleEntry<FhirResource>> | undefined,
  emit: (event: HarnessEvent) => void,
): Promise<ExtractedNote> {
  const startedAt = Date.now();
  let raw: string | undefined;
  let extracted: ExtractedNote;
  try {
    raw = attachment ? await rawText(attachment) : undefined;
    extracted =
      attachment && raw !== undefined
        ? await extractNoteText(attachment.data_record.content_type, raw)
        : { kind: 'unsupported', reason: 'missing-attachment' };
  } catch {
    extracted = { kind: 'unsupported', reason: 'extraction-failed' };
  }
  emit({
    t: 'NoteExtracted',
    docId,
    contentType: attachment?.data_record.content_type ?? 'no attachment',
    rawChars: raw?.length ?? 0,
    durationMs: Date.now() - startedAt,
    outcome:
      extracted.kind === 'text'
        ? {
            kind: 'text',
            format: extracted.format,
            chars: extracted.text.length,
          }
        : { kind: 'unsupported', reason: extracted.reason },
  });
  return extracted;
}
