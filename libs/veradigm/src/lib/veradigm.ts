import * as VeradigmEndpoints from './data/DSTU2Endpoints.json';

export interface DSTU2Endpoint {
  id: string;
  url: string;
  name: string;
  token?: string;
  authorize?: string;
}

export const VeradigmDSTU2TenantEndpoints: DSTU2Endpoint[] =
  Array.from(VeradigmEndpoints);
