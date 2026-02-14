import PracticeNameMap from './data/Organizations.json';

export type AthenaPracticeNameMap = Record<string, string>;

export const AthenaOrganizations: AthenaPracticeNameMap =
  PracticeNameMap as AthenaPracticeNameMap;

export function getUniqueTenantCount(): number {
  return Object.keys(AthenaOrganizations).length;
}
