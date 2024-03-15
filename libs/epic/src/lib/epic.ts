import EpicEndpoints from './data/DSTU2Endpoints.json';

/* eslint-disable-next-line */
export interface TenantEndpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
}

export const EpicDSTU2TenantEndpoints: TenantEndpoint[] =
  Array.from(EpicEndpoints);
