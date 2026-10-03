export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'text'; text: string };

export type PagedBlock = Block & { page: number };

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^(```|~~~)/;
const PAGE_LINK = /^\[[^\]]*\]\(#[^)]*\)$/;

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
