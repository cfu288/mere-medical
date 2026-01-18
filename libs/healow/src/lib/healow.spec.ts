import { HealowR4TenantEndpoints } from './healow';

describe('healow', () => {
  it('should have R4 endpoints', () => {
    expect(HealowR4TenantEndpoints.length).toBeGreaterThan(0);
  });
});
