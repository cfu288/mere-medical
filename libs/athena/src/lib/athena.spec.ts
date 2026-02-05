import { AthenaOrganizations } from './athena';

describe('AthenaOrganizations', () => {
  it('should be a non-empty record', () => {
    expect(Object.keys(AthenaOrganizations).length).toBeGreaterThan(0);
  });
});
