import { markdownToBlocks } from './blocks';
import { htmlToMarkdown } from './htmlToMarkdown';
import { ParsedDocument } from './sections';

export function webpage(bytes: Uint8Array): ParsedDocument {
  return {
    kind: 'webpage',
    blocks: markdownToBlocks(htmlToMarkdown(decode(bytes))),
  };
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
