export interface ParsedMessage {
  displayText: string;
  thinkingContent: string | null;
}

export function parseThinkingTags(
  text: string,
  isAiMessage: boolean,
): ParsedMessage {
  if (!isAiMessage) {
    return { displayText: text, thinkingContent: null };
  }

  // Support both <thinking> and <think> tags
  const thinkingRegex = /<(?:thinking|think)>([\s\S]*?)<\/(?:thinking|think)>/g;
  const thinkingMatches = text.match(thinkingRegex);

  if (!thinkingMatches) {
    return { displayText: text, thinkingContent: null };
  }

  const thinking = thinkingMatches
    .map((match) => match.replace(/<\/?(?:thinking|think)>/g, '').trim())
    .join('\n\n---\n\n');

  const cleaned = text.replace(thinkingRegex, '').trim();

  return {
    displayText: cleaned,
    thinkingContent: thinking,
  };
}
