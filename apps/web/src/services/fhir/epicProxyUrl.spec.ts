import { epicProxyUrl } from './Epic';

describe('epicProxyUrl', () => {
  it('builds a proxy url for a target type', () => {
    expect(
      epicProxyUrl('https://app.example.com', 'tenant-1', {
        targetType: 'register',
      }),
    ).toBe(
      'https://app.example.com/api/proxy?serviceId=tenant-1&target_type=register',
    );
  });

  it('includes the target when one is given', () => {
    expect(
      epicProxyUrl('https://app.example.com', 'tenant-1', {
        targetType: 'base',
        target: 'Patient?patient=123',
      }),
    ).toBe(
      'https://app.example.com/api/proxy?serviceId=tenant-1&target=Patient%3Fpatient%3D123&target_type=base',
    );
  });

  it('does not double the slash when the public url ends in one', () => {
    expect(
      epicProxyUrl('https://app.example.com/', 'tenant-1', {
        targetType: 'token',
      }),
    ).toBe(
      'https://app.example.com/api/proxy?serviceId=tenant-1&target_type=token',
    );
  });

  it('keeps a path prefix on the public url', () => {
    expect(
      epicProxyUrl('https://app.example.com/mere', 'tenant-1', {
        targetType: 'token',
      }),
    ).toBe(
      'https://app.example.com/mere/api/proxy?serviceId=tenant-1&target_type=token',
    );
  });

  it('keeps a path prefix that ends in a slash', () => {
    expect(
      epicProxyUrl('https://app.example.com/mere/', 'tenant-1', {
        targetType: 'token',
      }),
    ).toBe(
      'https://app.example.com/mere/api/proxy?serviceId=tenant-1&target_type=token',
    );
  });

  it('refuses to build a proxy url without a public url', () => {
    expect(() => epicProxyUrl('', 'tenant-1', { targetType: 'base' })).toThrow(
      'Cannot proxy a request without PUBLIC_URL',
    );
  });
});
