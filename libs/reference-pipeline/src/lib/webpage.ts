import { markdownToBlocks } from './blocks';
import { htmlToMarkdown } from './htmlToMarkdown';
import { ParsedDocument } from './sections';

/**
 * Parses the bytes of an HTML page into blocks, by {@link htmlToMarkdown} and
 * then {@link markdownToBlocks}.
 *
 * @param bytes `Uint8Array`. The page body, decoded as UTF-8.
 * @returns `ParsedDocument` of kind `'webpage'`.
 *
 * @example
 * webpage(new TextEncoder().encode('<main><h1>Measles</h1><p>Two doses.</p></main>'));
 * // {
 * //   kind: 'webpage',
 * //   blocks: [
 * //     { kind: 'heading', level: 1, text: 'Measles' },
 * //     { kind: 'text', text: 'Two doses.' },
 * //   ],
 * // }
 */
export function webpage(bytes: Uint8Array): ParsedDocument {
  return {
    kind: 'webpage',
    blocks: markdownToBlocks(htmlToMarkdown(new TextDecoder().decode(bytes))),
  };
}
