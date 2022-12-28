import EpicEndpoints from './DSTU2Endpoints.json';

/* eslint-disable-next-line */
export interface DSTU2Endpoint {
  id: string;
  url: string;
  name: string;
}

export const EpicDSTU2TenantEndpoints: DSTU2Endpoint[] = EpicEndpoints;
