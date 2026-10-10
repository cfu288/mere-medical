import TurndownService from 'turndown';
import { tables } from '@joplin/turndown-plugin-gfm';

export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  turndown.use(tables);
  const escapeMarkdown = turndown.escape.bind(turndown);
  turndown.escape = (text) => escapeMarkdown(text).replace(MARKUP_START, '\\<');
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

/** True for web, mail and relative addresses, judged by the URL parser so case, spacing and tab tricks in a scheme are caught. */
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
