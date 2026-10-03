import { stripRtf } from 'rtf-to-text';
import { stripHtmlTags } from '../../../services/fhir/R4';
import { CCDAStructureDefinitionKeys2_1 } from '../../timeline/components/document-reference/CCDAStructureDefinitionKeys2_1';
import {
  checkIfXmlIsCCDA,
  parseCCDARaw,
} from '../../timeline/components/document-reference/parseCCDA/parseCCDA';
import { MAX_NOTE_CHARS } from '../constants';

export type NoteFormat = 'ccda' | 'html' | 'plain' | 'rtf' | 'pdf';

export type ExtractedNote =
  | {
      kind: 'text';
      text: string;
      format: NoteFormat;
    }
  | {
      kind: 'unsupported';
      reason:
        | 'pdf-no-text-layer'
        | 'rtf-unreadable'
        | 'missing-attachment'
        | 'unknown-type'
        | 'extraction-failed'
        | 'empty';
    };

const CCDA_SECTION_PRIORITY: CCDAStructureDefinitionKeys2_1[] = [
  'HISTORY_OF_PRESENT_ILLNESS_SECTION',
  'DISCHARGE_SUMMARY',
  'HOSPITAL_COURSE_SECTION',
  'ASSESSMENT_AND_PLAN_SECTION',
  'ASSESSMENT_SECTION',
  'PROGRESS_NOTE',
  'CHIEF_COMPLAINT_SECTION',
  'REASON_FOR_VISIT_SECTION',
  'PLAN_OF_TREATMENT_SECTION',
  'PROBLEM_SECTION',
  'NOTES_SECTION',
];

export async function extractNoteText(
  contentType: string | undefined,
  raw: string,
): Promise<ExtractedNote> {
  const type = (contentType ?? '').toLowerCase();
  if (type.includes('xml')) {
    if (checkIfXmlIsCCDA(raw)) {
      return textNote(extractCcdaText(raw), 'ccda');
    }
    return textNote(stripHtmlTags(raw) ?? '', 'plain');
  }
  if (type.includes('html')) {
    return textNote(stripHtmlTags(raw) ?? '', 'html');
  }
  if (type.includes('text/plain')) {
    return textNote(raw, 'plain');
  }
  if (type.includes('rtf')) {
    const stripped = rtfToText(raw);
    if (stripped.replace(/\s/g, '').length < 40) {
      return { kind: 'unsupported', reason: 'rtf-unreadable' };
    }
    return textNote(stripped, 'rtf');
  }
  if (type.includes('pdf')) {
    const { extractPdfText } = await import('./extractPdfText');
    const text = await extractPdfText(raw);
    if (text.length < 50) {
      return { kind: 'unsupported', reason: 'pdf-no-text-layer' };
    }
    return textNote(text, 'pdf');
  }
  return { kind: 'unsupported', reason: 'unknown-type' };
}

function textNote(text: string, format: NoteFormat): ExtractedNote {
  if (!text.trim()) {
    return { kind: 'unsupported', reason: 'empty' };
  }
  const truncated =
    text.length > MAX_NOTE_CHARS
      ? text.slice(0, MAX_NOTE_CHARS) + '\n[truncated]'
      : text;
  return { kind: 'text', text: truncated, format };
}

function extractCcdaText(raw: string): string {
  const sections = parseCCDARaw(raw);
  const parts: string[] = [];
  for (const key of CCDA_SECTION_PRIORITY) {
    const text = stripHtmlTags(sections[key]);
    if (text) {
      parts.push(
        `== ${key.replace(/_SECTION$/, '').replace(/_/g, ' ')} ==\n${text}`,
      );
    }
  }
  return parts.join('\n\n');
}

/** RTF hex escapes are Windows-1252 bytes; the library decodes the unicode form and strips the rest. */
function rtfToText(raw: string): string {
  return stripRtf(
    raw.replace(/(?<!\\)\\'([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    ),
  );
}
