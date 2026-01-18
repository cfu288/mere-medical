import HealowEndpoints from './data/R4Endpoints.json';

export interface R4Endpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
}

export const HealowR4TenantEndpoints: R4Endpoint[] = Array.from(HealowEndpoints);
