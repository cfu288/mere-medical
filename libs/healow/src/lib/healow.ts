import HealowEndpoints from './data/R4Endpoints.json';

/* eslint-disable-next-line */
export interface TenantEndpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
}

export const HealowR4TenantEndpoints: TenantEndpoint[] =
  Array.from(HealowEndpoints);
