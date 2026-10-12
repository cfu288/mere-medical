import TurndownService from 'turndown';
import { tables } from '@joplin/turndown-plugin-gfm';

/**
 * Converts an HTML page to markdown.
 *
 * - Only the page's one `<main>` is converted, or else its one `<article>`,
 *   or else the whole page.
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
 * @returns `string`. Markdown with ATX headings, trimmed.
 *
 * @example
 * htmlToMarkdown('<nav>Home</nav><main><h1>Measles</h1><p>See <a href="https://www.cdc.gov/measles">CDC</a>.</p></main>');
 * // '# Measles\n\nSee [CDC](https://www.cdc.gov/measles).'
 */
export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  turndown.use(tables);
  const escapeMarkdown = turndown.escape.bind(turndown);
  // Markdown reads a bare <tag or <scheme:...> as HTML or a link.
  turndown.escape = (text) => escapeMarkdown(text).replace(MARKUP_START, '\\<');
  // A GFM table cell cannot hold a heading or a list. Tables with them are layout.
  turndown.addRule('layoutTable', {
    filter: (node) =>
      ['TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH'].includes(node.nodeName) &&
      isInLayoutTable(node),
    replacement: (content) => `\n\n${content}\n\n`,
  });
  turndown.addRule('unsafeLink', {
    filter: (node) =>
      node.nodeName === 'A' && !isSafeUrl(node.getAttribute('href') ?? ''),
    replacement: (content) => content,
  });
  turndown.addRule('unsafeImage', {
    filter: (node) =>
      node.nodeName === 'IMG' && !isSafeUrl(node.getAttribute('src') ?? ''),
    replacement: (_content, node) =>
      turndown.escape((node as HTMLElement).getAttribute('alt') ?? ''),
  });
  turndown.remove([
    'script',
    'style',
    'noscript',
    'iframe',
    'object',
    'embed',
    'template',
  ]);
  return turndown.turndown(mainContent(html)).trim();
}

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const MARKUP_START = /<(?=[a-z/!?])/gi;

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
export function isSafeUrl(value: string): boolean {
  try {
    return SAFE_PROTOCOLS.includes(
      new URL(value, 'https://relative.invalid/').protocol,
    );
  } catch {
    return false;
  }
}

function isInLayoutTable(node: HTMLElement): boolean {
  return Boolean(
    node.closest('table')?.querySelector('h1, h2, h3, h4, h5, h6, ul, ol'),
  );
}

function mainContent(html: string): string {
  return onlyElement(html, 'main') ?? onlyElement(html, 'article') ?? html;
}

// Node has no DOM here, and turndown parses the HTML string itself.
function onlyElement(html: string, tag: string): string | null {
  const opens = [...html.matchAll(new RegExp(`<${tag}[\\s>]`, 'gi'))];
  const closes = [...html.matchAll(new RegExp(`</${tag}>`, 'gi'))];
  if (opens.length !== 1 || closes.length !== 1) {
    return null;
  }
  const start = opens[0].index ?? 0;
  const end = (closes[0].index ?? 0) + closes[0][0].length;
  return start < end ? html.slice(start, end) : null;
}
