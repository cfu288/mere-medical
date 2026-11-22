import { DateInfo } from '../types';
import { ExtractedNote, NoteFormat } from './extractNoteText';

/** What reading one note's attachment found, for the run that read it. */
export type NoteExtraction = {
  docId: string;
  contentType: string;
  rawChars: number;
  durationMs: number;
  outcome:
    | { kind: 'text'; format: NoteFormat; chars: number }
    | { kind: 'unsupported'; reason: string };
};

export type NoteRecord = {
  alias: string;
  date: DateInfo;
  displayName: string;
  contentType: string;
  /** Extracts the note text once; onExtracted hears only the read that extracted it. */
  read: (
    onExtracted?: (extraction: NoteExtraction) => void,
  ) => Promise<ExtractedNote>;
};
