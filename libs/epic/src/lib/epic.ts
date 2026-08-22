import EpicDSTU2EndpointsData from './data/DSTU2Endpoints.json';
import EpicR4EndpointsData from './data/R4Endpoints.json';

/* eslint-disable-next-line */
export interface DSTU2Endpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
  managingOrganization?: string;
}

/* eslint-disable-next-line */
export interface R4Endpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
  managingOrganization?: string;
}

/** Server only - importing this in the web app ships the whole tenant catalog to the browser. */
export const EpicDSTU2TenantEndpoints: DSTU2Endpoint[] = Array.from(
  EpicDSTU2EndpointsData,
);

/** Server only - importing this in the web app ships the whole tenant catalog to the browser. */
export const EpicR4TenantEndpoints: R4Endpoint[] = Array.from(
  EpicR4EndpointsData,
);

export function getUniqueTenantCount(): number {
  const names = new Set([
    ...EpicDSTU2TenantEndpoints.map((e) => e.name),
    ...EpicR4TenantEndpoints.map((e) => e.name),
  ]);
  return names.size;
}
