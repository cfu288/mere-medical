import TurndownService from 'turndown';

const TAG_OR_AUTOLINK_START = /<(?=[a-z/!?])/gi;
const HASH_ONLY_LINE = /^(#{1,6})$/gm;

/**
 * Escapes text so markdown shows it as written. It applies turndown's own
 * escaping, then escapes each `<` that markdown reads as the start of an HTML
 * tag or a `<scheme:...>` link. It also escapes a line of only hash signs.
 *
 * @param text `string`. Plain text.
 * @returns `string`. Markdown that renders as `text`, except that text spelling
 * an HTML entity, such as `&amp;`, renders as the character.
 *
 * @example
 * escapeMarkdown('See <b>[1]</b>, aim for <130');
 * // 'See \\<b>\\[1\\]\\</b>, aim for <130'
 */
export function escapeMarkdown(text: string): string {
  return TurndownService.prototype
    .escape(text)
    .replace(TAG_OR_AUTOLINK_START, '\\<')
    .replace(HASH_ONLY_LINE, '\\$1');
}
