import { createDocument } from '@mixmark-io/domino';
import TurndownService from 'turndown';
import { tables } from '@joplin/turndown-plugin-gfm';

import { escapeMarkdown } from './escapeMarkdown';
import { Block } from './sections';

const HEADINGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
const REMOVED = [
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'template',
] as const;
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

const turndown = createMarkdownConverter();

/**
 * Parses an HTML page into heading and text blocks.
 *
 * - It reads only the page's one `<main>`, or else its one `<article>`, or
 *   else the whole body.
 * - Each `<h1>` to `<h6>`, at any depth, becomes a heading block with its
 *   text.
 * - The content between headings becomes one markdown text block.
 * - A table that holds headings or lists becomes plain blocks. Other tables
 *   become GFM tables.
 * - It drops scripts, styles, noscript, frames, embedded objects and templates.
 * - A link or image whose address is not safe (see {@link isHttpMailtoOrRelativeUrl}) keeps
 *   only its text or alt text.
 * - It escapes page text that spells a tag or a `<scheme:...>` link. Markdown
 *   shows that text as written.
 *
 * @param html `string`.
 * @returns `Block[]`. The blocks in reading order. Each has a null page.
 *
 * @example
 * htmlToBlocks('<nav>Home</nav><main><h1>Measles</h1><p>See <a href="https://www.cdc.gov/measles">CDC</a>.</p></main>');
 * // [
 * //   { kind: 'heading', level: 1, text: 'Measles', page: null },
 * //   { kind: 'text', text: 'See [CDC](https://www.cdc.gov/measles).', page: null },
 * // ]
 */
export function htmlToBlocks(html: string): Block[] {
  const doc = createDocument(html);
  unwrapLayoutTables(doc);
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
    } else if (REMOVED.some((tag) => node.matches(tag))) {
      return;
    } else if (HEADINGS.includes(node.nodeName)) {
      emitBufferedNodesAsText();
      blocks.push({
        kind: 'heading',
        level: Number(node.nodeName[1]),
        text: collapsedTextOf(node),
        page: null,
      });
    } else if (node.querySelector(HEADINGS.join(', '))) {
      node.childNodes.forEach(splitNodeAtHeadings);
    } else {
      bufferedNodes.push(node);
    }
  };
  findMainContent(doc).childNodes.forEach(splitNodeAtHeadings);
  emitBufferedNodesAsText();
  return blocks;
}

/**
 * Says whether a link address is safe to keep. Web, mail and relative
 * addresses are safe. The URL parser reads the scheme, and it catches case,
 * spacing and tab tricks.
 *
 * @param value `string`. A link or image address.
 * @returns `boolean`. True for `http:`, `https:`, `mailto:` and relative
 * addresses. False for any other scheme and for addresses that do not parse.
 *
 * @example
 * isHttpMailtoOrRelativeUrl('https://www.cdc.gov'); // true
 * isHttpMailtoOrRelativeUrl('/vaccines'); // true
 * isHttpMailtoOrRelativeUrl(' JaVaScRiPt:alert(1)'); // false
 */
function isHttpMailtoOrRelativeUrl(value: string): boolean {
  try {
    return SAFE_PROTOCOLS.includes(
      new URL(value, 'https://relative.invalid/').protocol,
    );
  } catch {
    return false;
  }
}

function createMarkdownConverter(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  service.use(tables);
  service.escape = escapeMarkdown;
  service.addRule('unsafeLink', {
    filter: (node) =>
      node.nodeName === 'A' &&
      !isHttpMailtoOrRelativeUrl(node.getAttribute('href') ?? ''),
    replacement: (content) => content,
  });
  service.addRule('unsafeImage', {
    filter: (node) =>
      node.nodeName === 'IMG' &&
      !isHttpMailtoOrRelativeUrl(node.getAttribute('src') ?? ''),
    replacement: (_content, node) =>
      service.escape((node as HTMLElement).getAttribute('alt') ?? ''),
  });
  service.remove([...REMOVED]);
  return service;
}

// A GFM table cell cannot hold a heading or a list. Tables with them are layout.
function unwrapLayoutTables(doc: Document): void {
  for (const table of Array.from(doc.querySelectorAll('table'))) {
    if (!table.querySelector('h1, h2, h3, h4, h5, h6, ul, ol')) {
      continue;
    }
    for (const cell of Array.from(table.querySelectorAll('td, th'))) {
      if (cell.closest('table') !== table) {
        continue;
      }
      const block = doc.createElement('div');
      for (const child of Array.from(cell.childNodes)) {
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
