import VeradigmEndpoints from './data/DSTU2Endpoints.json';

export interface TenantEndpoint {
  id: string;
  url: string;
  name: string;
  token?: string;
  authorize?: string;
}

export const VeradigmDSTU2TenantEndpoints: TenantEndpoint[] =
  Array.from(VeradigmEndpoints);
