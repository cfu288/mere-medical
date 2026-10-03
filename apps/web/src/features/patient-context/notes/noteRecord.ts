import { DateInfo } from '../types';
import { ExtractedNote } from './extractNoteText';

export type NoteRecord = {
  alias: string;
  date: DateInfo;
  displayName: string;
  contentType: string;
  read: () => Promise<ExtractedNote>;
};
