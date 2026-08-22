import VeradigmEndpoints from './data/DSTU2Endpoints.json';

export interface DSTU2Endpoint {
  id: string;
  url: string;
  name: string;
  token?: string;
  authorize?: string;
}

/** Server only - importing this in the web app ships the whole tenant catalog to the browser. */
export const VeradigmDSTU2TenantEndpoints: DSTU2Endpoint[] =
  Array.from(VeradigmEndpoints);

export function getUniqueTenantCount(): number {
  return VeradigmDSTU2TenantEndpoints.length;
}
