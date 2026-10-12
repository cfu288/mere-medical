import TurndownService from 'turndown';

const MARKUP_START = /<(?=[a-z/!?])/gi;

/**
 * Escapes text so markdown shows it as written. It applies turndown's own
 * escaping, then escapes a `<` that would start an HTML tag or a
 * `<scheme:...>` link.
 *
 * @param text `string`. Plain text.
 * @returns `string`. Markdown that renders as `text`.
 *
 * @example
 * escapeMarkdown('See <b>[1]</b>, aim for <130');
 * // 'See \\<b>\\[1\\]\\</b>, aim for <130'
 */
export function escapeMarkdown(text: string): string {
  return TurndownService.prototype.escape(text).replace(MARKUP_START, '\\<');
}
