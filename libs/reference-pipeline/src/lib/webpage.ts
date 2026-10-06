import { markdownToBlocks } from './blocks';
import { htmlToMarkdown } from './htmlToMarkdown';
import { ParsedDocument } from './sections';

export async function fetchJson(
  url: string,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<unknown> {
  return JSON.parse(decode(await fetchBytes(url)));
}

export function webpage(bytes: Uint8Array): ParsedDocument {
  return {
    kind: 'webpage',
    blocks: markdownToBlocks(htmlToMarkdown(decode(bytes))),
  };
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
