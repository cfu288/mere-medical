import {
  base64StringToBase64UrlString,
  base64UrlStringToBase64String,
  base64StringToArrayBuffer,
  base64UrlStringToArrayBuffer,
  arrayBufferToBase64String,
  arrayBufferToBase64UrlString,
  textStringToBase64String,
  textStringToBase64UrlString,
} from './base64';

describe('base64 utilities', () => {
  describe('base64StringToBase64UrlString', () => {
    it('replaces + with -', () => {
      expect(base64StringToBase64UrlString('a+b')).toBe('a-b');
    });

    it('replaces / with _', () => {
      expect(base64StringToBase64UrlString('a/b')).toBe('a_b');
    });

    it('removes padding', () => {
      expect(base64StringToBase64UrlString('abc=')).toBe('abc');
      expect(base64StringToBase64UrlString('ab==')).toBe('ab');
    });

    it('handles all transformations together', () => {
      expect(base64StringToBase64UrlString('a+b/c==')).toBe('a-b_c');
    });
  });

  describe('base64UrlStringToBase64String', () => {
    it('replaces - with +', () => {
      expect(base64UrlStringToBase64String('a-b')).toBe('a+b=');
    });

    it('replaces _ with /', () => {
      expect(base64UrlStringToBase64String('a_b')).toBe('a/b=');
    });

    it('adds correct padding for length % 4 == 2', () => {
      expect(base64UrlStringToBase64String('ab')).toBe('ab==');
    });

    it('adds correct padding for length % 4 == 3', () => {
      expect(base64UrlStringToBase64String('abc')).toBe('abc=');
    });

    it('adds no padding for length % 4 == 0', () => {
      expect(base64UrlStringToBase64String('abcd')).toBe('abcd');
    });

    it('throws for invalid length (% 4 == 1)', () => {
      expect(() => base64UrlStringToBase64String('a')).toThrow('InvalidLengthError');
    });
  });

  describe('roundtrip conversions', () => {
    it('converts base64 to ArrayBuffer and back', () => {
      const original = 'SGVsbG8gV29ybGQ=';
      const arrayBuffer = base64StringToArrayBuffer(original);
      const result = arrayBufferToBase64String(arrayBuffer);
      expect(result).toBe(original);
    });

    it('converts base64url to ArrayBuffer and back', () => {
      const base64 = 'SGVsbG8gV29ybGQ=';
      const base64url = base64StringToBase64UrlString(base64);
      const arrayBuffer = base64UrlStringToArrayBuffer(base64url);
      const result = arrayBufferToBase64UrlString(arrayBuffer);
      expect(result).toBe(base64url);
    });

    it('converts text to base64 correctly', () => {
      const text = 'Hello World';
      const base64 = textStringToBase64String(text);
      expect(base64).toBe('SGVsbG8gV29ybGQ=');
    });

    it('converts text to base64url correctly', () => {
      const text = 'Hello World';
      const base64url = textStringToBase64UrlString(text);
      expect(base64url).toBe('SGVsbG8gV29ybGQ');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(base64StringToBase64UrlString('')).toBe('');
      expect(textStringToBase64String('')).toBe('');
    });

    it('handles strings with special characters that become + and /', () => {
      const text = '>>>???';
      const base64 = textStringToBase64String(text);
      const base64url = base64StringToBase64UrlString(base64);
      expect(base64url).not.toContain('+');
      expect(base64url).not.toContain('/');
      expect(base64url).not.toContain('=');
    });
  });
});
