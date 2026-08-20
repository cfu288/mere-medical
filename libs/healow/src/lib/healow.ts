import HealowEndpoints from './data/R4Endpoints.json';

export interface R4Endpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
}

/** Server only - importing this in the web app ships the whole tenant catalog to the browser. */
export const HealowR4TenantEndpoints: R4Endpoint[] = Array.from(HealowEndpoints);

export function getUniqueTenantCount(): number {
  return HealowR4TenantEndpoints.length;
}
