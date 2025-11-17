import { stringSimilarity } from './string-similarity';

describe('stringSimilarity', () => {
  describe('exact matches', () => {
    it('should return 1.0 for identical strings', () => {
      expect(stringSimilarity('hello', 'hello')).toBe(1.0);
      expect(stringSimilarity('sandbox', 'sandbox')).toBe(1.0);
      expect(stringSimilarity('test', 'test')).toBe(1.0);
    });
  });

  describe('case sensitivity', () => {
    it('should be case-insensitive', () => {
      const lowerResult = stringSimilarity('Sandbox', 'sandbox');
      const upperResult = stringSimilarity('SANDBOX', 'sandbox');
      const mixedResult = stringSimilarity('SaNdBoX', 'sandbox');

      expect(lowerResult).toBe(1.0);
      expect(upperResult).toBe(1.0);
      expect(mixedResult).toBe(1.0);
    });
  });

  describe('partial matches', () => {
    it('should return high similarity for very similar strings', () => {
      const result = stringSimilarity('sandbox', 'sandboxes');
      expect(result).toBeGreaterThanOrEqual(0.7);
    });

    it('should return moderate similarity for somewhat similar strings', () => {
      const result = stringSimilarity('test', 'testing');
      expect(result).toBeGreaterThan(0.3);
      expect(result).toBeLessThan(0.8);
    });

    it('should return low similarity for dissimilar strings', () => {
      const result = stringSimilarity('hello', 'world');
      expect(result).toBeLessThan(0.3);
    });
  });

  describe('empty and null handling', () => {
    it('should return 0.0 for empty string vs non-empty', () => {
      expect(stringSimilarity('', 'hello')).toBe(0.0);
      expect(stringSimilarity('hello', '')).toBe(0.0);
    });

    it('should return 0.0 for both empty strings', () => {
      expect(stringSimilarity('', '')).toBe(0.0);
    });

    it('should return 0.0 for undefined strings', () => {
      expect(stringSimilarity(undefined as any, 'hello')).toBe(0.0);
      expect(stringSimilarity('hello', undefined as any)).toBe(0.0);
      expect(stringSimilarity(undefined as any, undefined as any)).toBe(0.0);
    });

    it('should return 0.0 for null strings', () => {
      expect(stringSimilarity(null as any, 'hello')).toBe(0.0);
      expect(stringSimilarity('hello', null as any)).toBe(0.0);
    });
  });

  describe('special characters', () => {
    it('should handle strings with hyphens', () => {
      const result = stringSimilarity('san-diego', 'san diego');
      expect(result).toBeGreaterThan(0.7);
    });

    it('should handle strings with numbers', () => {
      const result = stringSimilarity('test123', 'test124');
      expect(result).toBeGreaterThan(0.7);
    });

    it('should handle strings with special characters', () => {
      const result = stringSimilarity('test@example.com', 'test@example.org');
      expect(result).toBeGreaterThan(0.75);
    });
  });

  describe('string order independence', () => {
    it('should return same result regardless of parameter order', () => {
      const result1 = stringSimilarity('short', 'much longer string');
      const result2 = stringSimilarity('much longer string', 'short');

      expect(result1).toBe(result2);
    });

    it('should return same result for equal length strings in any order', () => {
      const result1 = stringSimilarity('hello', 'world');
      const result2 = stringSimilarity('world', 'hello');

      expect(result1).toBe(result2);
    });
  });

  describe('n-gram size parameter', () => {
    it('should use default gram size of 2 when not specified', () => {
      const withDefault = stringSimilarity('test', 'testing');
      const withExplicit = stringSimilarity('test', 'testing', 2);

      expect(withDefault).toBe(withExplicit);
      expect(withDefault).toBeCloseTo(0.615, 2);
    });

    it('should accept custom gram size and produce correct scores', () => {
      const gramSize2 = stringSimilarity('test', 'testing', 2);
      const gramSize3 = stringSimilarity('test', 'testing', 3);

      expect(gramSize2).toBeCloseTo(0.615, 2);
      expect(gramSize3).toBeCloseTo(0.533, 2);
    });

    it('should produce different scores for different gram sizes', () => {
      const gramSize1 = stringSimilarity('hello', 'hallo', 1);
      const gramSize2 = stringSimilarity('hello', 'hallo', 2);
      const gramSize3 = stringSimilarity('hello', 'hallo', 3);

      expect(gramSize1).toBe(0.8);
      expect(gramSize2).toBeCloseTo(0.667, 2);
      expect(gramSize3).toBeCloseTo(0.571, 2);
    });

    it('should handle gram size 1 (character-level comparison)', () => {
      const result = stringSimilarity('abc', 'aabbcc', 1);

      expect(result).toBeCloseTo(0.667, 2);
    });

    it('should produce score of 1.0 for identical strings regardless of gram size', () => {
      expect(stringSimilarity('hello', 'hello', 1)).toBe(1.0);
      expect(stringSimilarity('hello', 'hello', 2)).toBe(1.0);
      expect(stringSimilarity('hello', 'hello', 3)).toBe(1.0);
      expect(stringSimilarity('test', 'test', 4)).toBe(1.0);
    });

    it('should count duplicate n-grams (multiset behavior)', () => {
      const result1 = stringSimilarity('AA', 'AAAA', 1);
      const result2 = stringSimilarity('AA', 'AAAA', 2);

      expect(result1).toBeCloseTo(0.667, 2);
      expect(result2).toBe(0.75);
    });
  });

  describe('real-world tenant search scenarios', () => {
    it('should find "sandbox" in "Cerner Sandbox"', () => {
      const result = stringSimilarity('Cerner', 'sandbox');
      expect(result).toBeLessThan(0.5);

      const result2 = stringSimilarity('Sandbox', 'sandbox');
      expect(result2).toBe(1.0);
    });

    it('should match clinic variations', () => {
      const result1 = stringSimilarity('clinic', 'Clinical');
      const result2 = stringSimilarity('clinic', 'Clinics');

      expect(result1).toBeGreaterThan(0.6);
      expect(result2).toBeGreaterThan(0.6);
    });

    it('should handle hospital name variations', () => {
      const result = stringSimilarity('General Hospital', 'hospital');
      expect(result).toBeGreaterThan(0.3);
    });
  });

  describe('edge cases', () => {
    it('should handle single character strings', () => {
      const result = stringSimilarity('a', 'a');
      expect(result).toBeGreaterThan(0);
    });

    it('should handle single character vs multi-character', () => {
      const result = stringSimilarity('a', 'abc');
      expect(result).toBeGreaterThan(0);
    });

    it('should handle strings with only whitespace differences', () => {
      const result = stringSimilarity('hello world', 'helloworld');
      expect(result).toBeGreaterThan(0.8);
    });
  });
});
