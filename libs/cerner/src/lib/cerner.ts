import CernerDSTU2Endpoints from './data/DSTU2Endpoints.json';
import CernerR4Endpoints from './data/R4Endpoints.json';

export interface DSTU2Endpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
}

export interface R4Endpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
}

export const CernerDSTU2TenantEndpoints: DSTU2Endpoint[] =
  Array.from(CernerDSTU2Endpoints);

export const CernerR4TenantEndpoints: R4Endpoint[] =
  Array.from(CernerR4Endpoints);
