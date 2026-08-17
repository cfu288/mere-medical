import VeradigmEndpoints from './data/R4Endpoints.json';

export interface VeradigmEndpoint {
  id: string;
  url: string;
  name: string;
  token?: string;
  authorize?: string;
}

export const VeradigmR4TenantEndpoints: VeradigmEndpoint[] =
  Array.from(VeradigmEndpoints);

export function getUniqueTenantCount(): number {
  return VeradigmR4TenantEndpoints.length;
}
