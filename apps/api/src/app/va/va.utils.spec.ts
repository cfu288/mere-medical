import { buildVARedirectUrl } from './va.utils';

describe('buildVARedirectUrl', () => {
  const baseUrl = 'https://app.example.com';

  describe('normal usage', () => {
    it('builds URL with code and state', () => {
      const result = buildVARedirectUrl(baseUrl, 'abc123', 'state456');
      expect(result).toBe(
        'https://app.example.com/va/callback?code=abc123&state=state456',
      );
    });

    it('builds URL with only code when state is undefined', () => {
      const result = buildVARedirectUrl(baseUrl, 'abc123', undefined);
      expect(result).toBe('https://app.example.com/va/callback?code=abc123');
    });

    it('builds URL with only code when state is empty string', () => {
      const result = buildVARedirectUrl(baseUrl, 'abc123', '');
      expect(result).toBe('https://app.example.com/va/callback?code=abc123');
    });
  });

  describe('XSS prevention', () => {
    it('encodes JavaScript injection in code parameter', () => {
      const maliciousCode = '");alert(document.cookie)//';
      const result = buildVARedirectUrl(baseUrl, maliciousCode, 'state');
      expect(result).not.toContain('");');
      expect(result).not.toContain('alert(');
      const url = new URL(result);
      expect(url.searchParams.get('code')).toBe(maliciousCode);
    });

    it('encodes script tags in code parameter', () => {
      const maliciousCode = '"><script>alert(1)</script>';
      const result = buildVARedirectUrl(baseUrl, maliciousCode, 'state');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('encodes JavaScript injection in state parameter', () => {
      const maliciousState = '");alert("xss");//';
      const result = buildVARedirectUrl(baseUrl, 'code', maliciousState);
      expect(result).not.toContain('");');
      expect(result).not.toContain('alert(');
    });

    it('encodes HTML entities in parameters', () => {
      const result = buildVARedirectUrl(baseUrl, '<>&"\'', '<>&"\'');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('"');
    });
  });

  describe('special characters', () => {
    it('encodes spaces in parameters', () => {
      const result = buildVARedirectUrl(
        baseUrl,
        'code with spaces',
        'state with spaces',
      );
      expect(result).not.toContain('code with spaces');
      const url = new URL(result);
      expect(url.searchParams.get('code')).toBe('code with spaces');
    });

    it('encodes ampersands to prevent parameter injection', () => {
      const result = buildVARedirectUrl(
        baseUrl,
        'code&injected=value',
        'state',
      );
      expect(result).toContain('code%26injected%3Dvalue');
      const url = new URL(result);
      expect(url.searchParams.get('injected')).toBeNull();
    });
  });
});
