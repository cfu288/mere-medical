import { ConfigService } from './config.service';
import { serverVendorConfig } from '../vendor-config.server';

jest.mock('../vendor-config.server', () => ({
  serverVendorConfig: jest.fn(() => ({ registrationAccess: { mode: 'open' } })),
}));

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

    it('reports that a token is required on a keyed instance without exposing it', () => {
      jest.mocked(serverVendorConfig).mockReturnValue({
        registrationAccess: {
          mode: 'keyed',
          token: 'valid-registration-token',
        },
      } as ReturnType<typeof serverVendorConfig>);

      const config = service.getPublicConfig();

      expect(config.REGISTRATION_TOKEN_REQUIRED).toBe(true);
      expect(JSON.stringify(config)).not.toContain('valid-registration-token');
    });

    it('passes the contact of a keyed instance', () => {
      jest.mocked(serverVendorConfig).mockReturnValue({
        registrationAccess: {
          mode: 'keyed',
          token: 'valid-registration-token',
          contact: 'admin@mere.example',
        },
      } as ReturnType<typeof serverVendorConfig>);

      expect(service.getPublicConfig().APP_CONTACT).toBe('admin@mere.example');
    });

    it.each([['open'], ['public']])(
      'reports no key required on an %s instance',
      (mode) => {
        jest.mocked(serverVendorConfig).mockReturnValue({
          registrationAccess: { mode },
        } as ReturnType<typeof serverVendorConfig>);

        expect(service.getPublicConfig().REGISTRATION_TOKEN_REQUIRED).toBe(
          false,
        );
      },
    );
  });
});
