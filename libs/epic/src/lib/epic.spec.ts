import { EpicDSTU2TenantEndpoints, EpicR4TenantEndpoints } from './epic';

const allEndpoints = [...EpicDSTU2TenantEndpoints, ...EpicR4TenantEndpoints];

describe('epic endpoint data', () => {
  it('gives every tenant an id that is unique across DSTU2 and R4', () => {
    const ids = allEndpoints.map((e) => e.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every tenant an authorize url ending in /authorize', () => {
    const notEndingInAuthorize = allEndpoints
      .filter((e) => !e.authorize.endsWith('/authorize'))
      .map((e) => e.authorize);

    expect(notEndingInAuthorize).toEqual([]);
  });

  it('gives every tenant a base url ending in a slash', () => {
    const notEndingInSlash = allEndpoints
      .filter((e) => !e.url.endsWith('/'))
      .map((e) => e.url);

    expect(notEndingInSlash).toEqual([]);
  });
});
