import { parseProxyTarget } from './proxy-targets';

describe('parseProxyTarget', () => {
  it('keeps a target type the vendor serves', () => {
    expect(parseProxyTarget('epic', 'register')).toEqual({
      vendor: 'epic',
      targetType: 'register',
    });
  });

  it('normalizes a register request to base for a vendor without registration', () => {
    expect(parseProxyTarget('healow', 'register')).toEqual({
      vendor: 'healow',
      targetType: 'base',
    });
  });

  it('normalizes an unknown target type to base', () => {
    expect(parseProxyTarget('epic', 'garbage')).toEqual({
      vendor: 'epic',
      targetType: 'base',
    });
  });

  it('normalizes a missing target type to base', () => {
    expect(parseProxyTarget('epic', undefined)).toEqual({
      vendor: 'epic',
      targetType: 'base',
    });
  });

  it('keeps a healow token request', () => {
    expect(parseProxyTarget('healow', 'token')).toEqual({
      vendor: 'healow',
      targetType: 'token',
    });
  });
});
