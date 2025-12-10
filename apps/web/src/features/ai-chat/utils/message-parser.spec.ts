import { parseThinkingTags } from './message-parser';

describe('parseThinkingTags', () => {
  describe('for non-AI messages', () => {
    it('returns text unchanged', () => {
      const result = parseThinkingTags('Hello world', false);
      expect(result).toEqual({
        displayText: 'Hello world',
        thinkingContent: null,
      });
    });

    it('does not parse thinking tags in user messages', () => {
      const text = '<thinking>internal thought</thinking>Hello';
      const result = parseThinkingTags(text, false);
      expect(result).toEqual({
        displayText: text,
        thinkingContent: null,
      });
    });
  });

  describe('for AI messages', () => {
    it('returns text unchanged when no thinking tags present', () => {
      const result = parseThinkingTags('Just a normal response', true);
      expect(result).toEqual({
        displayText: 'Just a normal response',
        thinkingContent: null,
      });
    });

    it('extracts content from <thinking> tags', () => {
      const text =
        '<thinking>This is internal reasoning</thinking>Here is my response';
      const result = parseThinkingTags(text, true);
      expect(result).toEqual({
        displayText: 'Here is my response',
        thinkingContent: 'This is internal reasoning',
      });
    });

    it('extracts content from <think> tags', () => {
      const text = '<think>Quick thought</think>My answer';
      const result = parseThinkingTags(text, true);
      expect(result).toEqual({
        displayText: 'My answer',
        thinkingContent: 'Quick thought',
      });
    });

    it('handles multiple thinking blocks', () => {
      const text =
        '<thinking>First thought</thinking>Middle text<think>Second thought</think>Final text';
      const result = parseThinkingTags(text, true);
      expect(result).toEqual({
        displayText: 'Middle textFinal text',
        thinkingContent: 'First thought\n\n---\n\nSecond thought',
      });
    });

    it('handles multiline content in thinking tags', () => {
      const text = `<thinking>
Line 1
Line 2
Line 3
</thinking>
Response text`;
      const result = parseThinkingTags(text, true);
      expect(result).toEqual({
        displayText: 'Response text',
        thinkingContent: 'Line 1\nLine 2\nLine 3',
      });
    });

    it('handles empty thinking tags', () => {
      const text = '<thinking></thinking>Response';
      const result = parseThinkingTags(text, true);
      expect(result).toEqual({
        displayText: 'Response',
        thinkingContent: '',
      });
    });

    it('handles nested content correctly', () => {
      const text =
        '<thinking>Thought with <code>code</code> inside</thinking>Response';
      const result = parseThinkingTags(text, true);
      expect(result).toEqual({
        displayText: 'Response',
        thinkingContent: 'Thought with <code>code</code> inside',
      });
    });

    it('preserves whitespace in display text', () => {
      const text = '<thinking>Hidden</thinking>  Response with  spaces  ';
      const result = parseThinkingTags(text, true);
      expect(result).toEqual({
        displayText: 'Response with  spaces',
        thinkingContent: 'Hidden',
      });
    });
  });
});
