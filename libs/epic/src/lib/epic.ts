import EpicDSTU2EndpointsData from './data/DSTU2Endpoints.json';
import EpicR4EndpointsData from './data/R4Endpoints.json';

/* eslint-disable-next-line */
export interface DSTU2Endpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
}

/* eslint-disable-next-line */
export interface R4Endpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
}

export const EpicDSTU2TenantEndpoints: DSTU2Endpoint[] = Array.from(
  EpicDSTU2EndpointsData,
);

export const EpicR4TenantEndpoints: R4Endpoint[] = Array.from(
  EpicR4EndpointsData,
);
