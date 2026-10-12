export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'text'; text: string };

export type PagedBlock = Block & { page: number };

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^(```|~~~)/;
// A heading that only links to an anchor is a table of contents entry.
const PAGE_LINK = /^\[[^\]]*\]\(#[^)]*\)$/;

/**
 * Splits markdown into heading and text blocks.
 *
 * - An ATX heading (`#` to `######`) becomes a heading block, with link
 *   markup removed from its text.
 * - A heading that is only a link to a place on the page, such as
 *   `## [Goals](#goals)`, is kept as text.
 * - Lines between headings join into one text block. A `#` line inside a
 *   fenced code block is text.
 *
 * @param markdown `string`.
 * @returns `Block[]`, in document order. Text blocks are trimmed and never
 * empty.
 *
 * @example
 * markdownToBlocks('# Hypertension\n\nScreen adults yearly.\n\n## [Goals](#goals)\n\nBelow 130.');
 * // [
 * //   { kind: 'heading', level: 1, text: 'Hypertension' },
 * //   { kind: 'text', text: 'Screen adults yearly.\n\n[Goals](#goals)\n\nBelow 130.' },
 * // ]
 */
export function markdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let pending: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = pending.join('\n').trim();
    if (text) {
      blocks.push({ kind: 'text', text });
    }
    pending = [];
  };

  for (const line of markdown.split('\n')) {
    if (FENCE.test(line.trim())) {
      inFence = !inFence;
    }
    const heading = inFence ? null : HEADING.exec(line);
    const onlyPageLink = heading !== null && PAGE_LINK.test(heading[2].trim());
    if (heading && !onlyPageLink) {
      flush();
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        text: stripLinks(heading[2]).trim(),
      });
    } else if (heading) {
      pending.push(heading[2].trim());
    } else {
      pending.push(line);
    }
  }
  flush();
  return blocks;
}

function stripLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}
