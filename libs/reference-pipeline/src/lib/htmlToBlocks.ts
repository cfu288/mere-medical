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
const REMOVED_TAGS = ['script', 'style', 'noscript', 'iframe', 'object', 'nav'];

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
 * - It drops scripts, styles, noscript fallbacks, frames, objects and `<nav>`
 *   navigation.
 * - A link keeps only its text, and an image only its alt text.
 *
 * @param html `string`.
 * @returns `Block[]`. The blocks in reading order.
 *
 * @example
 * htmlToBlocks('<nav>Home</nav><main><h1>Measles</h1><p>See <a href="https://www.cdc.gov/measles">CDC</a>.</p></main>');
 * // [
 * //   { kind: 'heading', level: 1, text: 'Measles' },
 * //   { kind: 'text', text: 'See CDC.' },
 * // ]
 */
export function htmlToBlocks(html: string): Block[] {
  const doc = parseReadableDocument(html);
  const nodes = Array.from(findMainContent(doc).childNodes).flatMap(
    nodesSplitAtHeadings,
  );
  const blocks: Block[] = [];
  let textNodes: Node[] = [];
  for (const node of nodes) {
    if (isHeading(node)) {
      blocks.push(...nodesToTextBlock(doc, textNodes), headingToBlock(node));
      textNodes = [];
    } else {
      textNodes.push(node);
    }
  }
  blocks.push(...nodesToTextBlock(doc, textNodes));
  return blocks;
}

function createMarkdownConverter(): TurndownService {
  const converter = new TurndownService({ codeBlockStyle: 'fenced' });
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

function parseReadableDocument(html: string): Document {
  const doc = createDocument(html);
  removeElementsWithoutReadableText(doc);
  unwrapTablesMarkdownCannotHold(doc);
  return doc;
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
  return (
    onlyElementMatching(doc, 'main') ??
    onlyElementMatching(doc, 'article') ??
    doc.body
  );
}

function onlyElementMatching(doc: Document, tag: string): Element | null {
  const found = doc.querySelectorAll(tag);
  return found.length === 1 ? found[0] : null;
}

function nodesSplitAtHeadings(node: Node): Node[] {
  if (
    isElement(node) &&
    !isHeading(node) &&
    node.querySelector(HEADING_TAGS.join(', '))
  ) {
    return Array.from(node.childNodes).flatMap(nodesSplitAtHeadings);
  }
  return [node];
}

function nodesToTextBlock(doc: Document, nodes: Node[]): Block[] {
  const container = doc.createElement('div');
  for (const node of nodes) {
    container.appendChild(node.cloneNode(true));
  }
  const text = turndown.turndown(container).trim();
  return text ? [{ kind: 'text', text }] : [];
}

function headingToBlock(heading: Element): Block {
  return {
    kind: 'heading',
    level: Number(heading.nodeName[1]),
    text: collapsedTextOf(heading),
  };
}

function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE;
}

function isHeading(node: Node): node is HTMLHeadingElement {
  return isElement(node) && HEADING_TAGS.includes(node.nodeName);
}

function collapsedTextOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}
