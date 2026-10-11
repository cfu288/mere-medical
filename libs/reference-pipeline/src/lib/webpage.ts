import { markdownToBlocks } from './blocks';
import { htmlToMarkdown } from './htmlToMarkdown';
import { ParsedDocument } from './sections';

export function webpage(bytes: Uint8Array): ParsedDocument {
  return {
    kind: 'webpage',
    blocks: markdownToBlocks(htmlToMarkdown(new TextDecoder().decode(bytes))),
  };
}
