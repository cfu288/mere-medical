import * as EpicEndpoints from './data/DSTU2Endpoints.json';

/* eslint-disable-next-line */
export interface DSTU2Endpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
}

export const EpicDSTU2TenantEndpoints: DSTU2Endpoint[] =
  Array.from(EpicEndpoints);
