import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;
  const originalEnv = process.env;

  beforeEach(() => {
    service = new ConfigService();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getPublicConfig', () => {
    it('returns config values from environment variables', () => {
      process.env.EPIC_CLIENT_ID = 'test-epic-id';
      process.env.PUBLIC_URL = 'https://example.com';

      const config = service.getPublicConfig();

      expect(config.EPIC_CLIENT_ID).toBe('test-epic-id');
      expect(config.PUBLIC_URL).toBe('https://example.com');
    });

    it('returns undefined for unset environment variables', () => {
      delete process.env.EPIC_CLIENT_ID;

      const config = service.getPublicConfig();

      expect(config.EPIC_CLIENT_ID).toBeUndefined();
    });
  });
});
