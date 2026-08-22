import { EpicDSTU2TenantEndpoints, EpicR4TenantEndpoints } from '@mere/epic';
import { HealowR4TenantEndpoints } from '@mere/healow';

describe('proxy vendor catalogs', () => {
  it('gives every tenant id exactly one vendor', () => {
    const epicIds = new Set(
      [...EpicDSTU2TenantEndpoints, ...EpicR4TenantEndpoints].map((e) => e.id),
    );
    const sharedIds = HealowR4TenantEndpoints.map((e) => e.id).filter((id) =>
      epicIds.has(id),
    );

    expect(sharedIds).toEqual([]);
  });
});
