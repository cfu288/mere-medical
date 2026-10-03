import TurndownService from 'turndown';
import { tables } from '@joplin/turndown-plugin-gfm';

export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  turndown.use(tables);
  turndown.addRule('layoutTable', {
    filter: (node) =>
      ['TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH'].includes(node.nodeName) &&
      isInLayoutTable(node),
    replacement: (content) => `\n\n${content}\n\n`,
  });
  turndown.remove(['script', 'style']);
  return turndown.turndown(mainContent(html)).trim();
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
