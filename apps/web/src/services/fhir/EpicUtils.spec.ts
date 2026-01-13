import { isEpicSandbox, EPIC_SANDBOX_IDS } from './EpicUtils';

describe('EpicUtils', () => {
  describe('EPIC_SANDBOX_IDS', () => {
    it('contains expected sandbox identifiers', () => {
      expect(EPIC_SANDBOX_IDS).toContain('sandbox_epic');
      expect(EPIC_SANDBOX_IDS).toContain('sandbox_epic_r4');
      expect(EPIC_SANDBOX_IDS).toHaveLength(2);
    });
  });

  describe('isEpicSandbox', () => {
    it('returns true for sandbox_epic', () => {
      expect(isEpicSandbox('sandbox_epic')).toBe(true);
    });

    it('returns true for sandbox_epic_r4', () => {
      expect(isEpicSandbox('sandbox_epic_r4')).toBe(true);
    });

    it('returns false for production epic IDs', () => {
      expect(isEpicSandbox('70c2d451-3325-eb11-9135-001dd8b71f1a')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isEpicSandbox(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isEpicSandbox('')).toBe(false);
    });
  });
});
