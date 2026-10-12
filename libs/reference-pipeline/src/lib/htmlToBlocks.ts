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

const turndown = createTurndown();

/**
 * Parses an HTML page into heading and text blocks.
 *
 * - Only the page's one `<main>` is read, or else its one `<article>`, or
 *   else the whole body.
 * - Each `<h1>` to `<h6>`, at any depth, becomes a heading block with its
 *   text.
 * - The content between headings becomes one markdown text block.
 * - A table that holds headings or lists becomes plain blocks. Other tables
 *   become GFM tables.
 * - Scripts, styles, noscript, frames, embedded objects and templates are
 *   dropped.
 * - A link or image whose address is not safe (see {@link isSafeUrl}) keeps
 *   only its text or alt text.
 * - Page text that spells a tag or an `<scheme:...>` link is escaped and
 *   stays text.
 *
 * @param html `string`.
 * @returns `Block[]`, in reading order, each with a null page.
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
  const blocks: Block[] = [];
  let run: Node[] = [];
  const flush = () => {
    const container = doc.createElement('div');
    for (const node of run) {
      container.appendChild(node.cloneNode(true));
    }
    const text = turndown.turndown(container).trim();
    if (text) {
      blocks.push({ kind: 'text', text, page: null });
    }
    run = [];
  };
  const visit = (node: Node) => {
    if (!isElement(node)) {
      run.push(node);
    } else if (REMOVED.some((tag) => node.matches(tag))) {
      return;
    } else if (HEADINGS.includes(node.nodeName)) {
      flush();
      blocks.push({
        kind: 'heading',
        level: Number(node.nodeName[1]),
        text: plainText(node),
        page: null,
      });
    } else if (node.querySelector(HEADINGS.join(', '))) {
      node.childNodes.forEach(visit);
    } else {
      run.push(node);
    }
  };
  mainContent(doc).childNodes.forEach(visit);
  flush();
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
 * isSafeUrl('https://www.cdc.gov'); // true
 * isSafeUrl('/vaccines'); // true
 * isSafeUrl(' JaVaScRiPt:alert(1)'); // false
 */
function isSafeUrl(value: string): boolean {
  try {
    return SAFE_PROTOCOLS.includes(
      new URL(value, 'https://relative.invalid/').protocol,
    );
  } catch {
    return false;
  }
}

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  service.use(tables);
  service.escape = escapeMarkdown;
  // A GFM table cell cannot hold a heading or a list. Tables with them are layout.
  service.addRule('layoutTable', {
    filter: (node) =>
      ['TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH'].includes(node.nodeName) &&
      Boolean(
        node.closest('table')?.querySelector('h1, h2, h3, h4, h5, h6, ul, ol'),
      ),
    replacement: (content) => `\n\n${content}\n\n`,
  });
  service.addRule('unsafeLink', {
    filter: (node) =>
      node.nodeName === 'A' && !isSafeUrl(node.getAttribute('href') ?? ''),
    replacement: (content) => content,
  });
  service.addRule('unsafeImage', {
    filter: (node) =>
      node.nodeName === 'IMG' && !isSafeUrl(node.getAttribute('src') ?? ''),
    replacement: (_content, node) =>
      service.escape((node as HTMLElement).getAttribute('alt') ?? ''),
  });
  service.remove([...REMOVED]);
  return service;
}

function mainContent(doc: Document): Element {
  const only = (tag: string) => {
    const found = doc.querySelectorAll(tag);
    return found.length === 1 ? found[0] : null;
  };
  return only('main') ?? only('article') ?? doc.body;
}

function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE;
}

function plainText(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}
