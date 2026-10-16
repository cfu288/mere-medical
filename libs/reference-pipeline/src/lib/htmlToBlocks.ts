import { createDocument } from '@mixmark-io/domino';
import TurndownService from 'turndown';
import { tables } from '@joplin/turndown-plugin-gfm';

import { Block } from './sections';

const HEADING_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
// A GFM table cell cannot hold these.
const TAGS_A_GFM_TABLE_CANNOT_HOLD = [
  ...HEADING_TAGS,
  'UL',
  'OL',
  'HR',
  'BLOCKQUOTE',
  'PRE',
];
const REMOVED_TAGS = ['script', 'style', 'noscript', 'iframe', 'object'];

const turndown = createMarkdownConverter();

/**
 * Parses an HTML page into heading and text blocks.
 *
 * - It reads only the page's one `<main>`, or else its one `<article>`, or
 *   else the whole body.
 * - Each `<h1>` to `<h6>`, at any depth, becomes a heading block with its
 *   text.
 * - The content between headings becomes one markdown text block.
 * - A table that holds a heading, list, rule, quote or code block becomes plain
 *   blocks, its caption first. Other tables become GFM tables.
 * - It drops scripts, styles, noscript fallbacks, frames and objects.
 * - A link keeps only its text, and an image only its alt text.
 *
 * @param html `string`.
 * @returns `Block[]`. The blocks in reading order. Each has a null page.
 *
 * @example
 * htmlToBlocks('<nav>Home</nav><main><h1>Measles</h1><p>See <a href="https://www.cdc.gov/measles">CDC</a>.</p></main>');
 * // [
 * //   { kind: 'heading', level: 1, text: 'Measles', page: null },
 * //   { kind: 'text', text: 'See CDC.', page: null },
 * // ]
 */
export function htmlToBlocks(html: string): Block[] {
  const doc = createDocument(html);
  removeElementsWithoutReadableText(doc);
  unwrapTablesMarkdownCannotHold(doc);
  const blocks: Block[] = [];
  let bufferedNodes: Node[] = [];
  const emitBufferedNodesAsText = () => {
    const container = doc.createElement('div');
    for (const node of bufferedNodes) {
      container.appendChild(node.cloneNode(true));
    }
    const text = turndown.turndown(container).trim();
    if (text) {
      blocks.push({ kind: 'text', text, page: null });
    }
    bufferedNodes = [];
  };
  const splitNodeAtHeadings = (node: Node) => {
    if (!isElement(node)) {
      bufferedNodes.push(node);
    } else if (HEADING_TAGS.includes(node.nodeName)) {
      emitBufferedNodesAsText();
      blocks.push({
        kind: 'heading',
        level: Number(node.nodeName[1]),
        text: collapsedTextOf(node),
        page: null,
      });
    } else if (node.querySelector(HEADING_TAGS.join(', '))) {
      node.childNodes.forEach(splitNodeAtHeadings);
    } else {
      bufferedNodes.push(node);
    }
  };
  findMainContent(doc).childNodes.forEach(splitNodeAtHeadings);
  emitBufferedNodesAsText();
  return blocks;
}

function createMarkdownConverter(): TurndownService {
  const converter = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  converter.use(tables);
  converter.addRule('linkText', {
    filter: 'a',
    replacement: (content) => content,
  });
  converter.addRule('imageAltText', {
    filter: 'img',
    replacement: (_content, node) =>
      converter.escape((node as HTMLElement).getAttribute('alt') ?? ''),
  });
  return converter;
}

function removeElementsWithoutReadableText(doc: Document): void {
  const removed = doc.querySelectorAll(REMOVED_TAGS.join(', '));
  for (const element of Array.from(removed)) {
    element.parentNode?.removeChild(element);
  }
}

function unwrapTablesMarkdownCannotHold(doc: Document): void {
  for (const table of Array.from(doc.querySelectorAll('table'))) {
    if (!table.querySelector(TAGS_A_GFM_TABLE_CANNOT_HOLD.join(', '))) {
      continue;
    }
    for (const part of Array.from(table.querySelectorAll('caption, td, th'))) {
      if (part.closest('table') !== table) {
        continue;
      }
      const block = doc.createElement('div');
      for (const child of Array.from(part.childNodes)) {
        block.appendChild(child);
      }
      table.parentNode?.insertBefore(block, table);
    }
    table.parentNode?.removeChild(table);
  }
}

function findMainContent(doc: Document): Element {
  const onlyElementMatching = (tag: string) => {
    const found = doc.querySelectorAll(tag);
    return found.length === 1 ? found[0] : null;
  };
  return (
    onlyElementMatching('main') ?? onlyElementMatching('article') ?? doc.body
  );
}

function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE;
}

function collapsedTextOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}
