import type { FhirVersion } from '@mere/shared';
import type { FhirBundle } from './schemas';
import {
  DirectoryEntry,
  DirectorySource,
  SandboxSeed,
  VendorAdapter,
  httpDirectory,
} from './types';

const DIRECTORY: Record<FhirVersion, { env: string; url: string }> = {
  R4: {
    env: 'CERNER_R4_ENDPOINTS_URL',
    url: 'https://raw.githubusercontent.com/oracle-samples/ignite-endpoints/refs/heads/main/oracle_health_fhir_endpoints/millennium_patient_r4_endpoints.json',
  },
  DSTU2: {
    env: 'CERNER_DSTU2_ENDPOINTS_URL',
    // Pinned commit: ignite-endpoints main no longer carries the DSTU2 list.
    url: 'https://raw.githubusercontent.com/oracle-samples/ignite-endpoints/30bce23a24731f7c38c1da8aec94321ba9c223cb/millennium_patient_dstu2_endpoints.json',
  },
};

const SANDBOX_TENANT = 'ec2458f2-1e24-41c8-b71b-0e701af7583d';
const CERNER_PATIENT_HOST = 'fhir-myrecord.cerner.com';

const SANDBOX_TOKEN = `https://authorization.cerner.com/tenants/${SANDBOX_TENANT}/hosts/${CERNER_PATIENT_HOST}/protocols/oauth2/profiles/smart-v1/token`;

const SANDBOX: Record<FhirVersion, SandboxSeed> = {
  R4: {
    tenantId: 'sandbox_cerner_r4',
    name: 'Cerner Sandbox (R4)',
    url: `https://${CERNER_PATIENT_HOST}/r4/${SANDBOX_TENANT}/`,
    token: SANDBOX_TOKEN,
    authorize: `https://authorization.cerner.com/tenants/${SANDBOX_TENANT}/protocols/oauth2/profiles/smart-v1/personas/patient/authorize`,
  },
  DSTU2: {
    tenantId: 'sandbox_cerner',
    name: 'Cerner Sandbox',
    url: `https://${CERNER_PATIENT_HOST}/dstu2/${SANDBOX_TENANT}/`,
    token: SANDBOX_TOKEN,
    authorize: `https://authorization.cerner.com/tenants/${SANDBOX_TENANT}/protocols/oauth2/profiles/smart-v1/personas/patient/authorize`,
  },
};

export const cernerAdapter: VendorAdapter = {
  versions: ['DSTU2', 'R4'],

  directory(version: FhirVersion): DirectorySource | null {
    const source = DIRECTORY[version];
    return httpDirectory(process.env[source.env] ?? source.url);
  },

  parseDirectory(bundle: FhirBundle): DirectoryEntry[] {
    const namesByEndpointId = new Map<string, string>();
    for (const { resource } of bundle.entry) {
      if (resource?.resourceType !== 'Organization' || !resource.name) continue;
      for (const link of resource.endpoint ?? []) {
        const endpointId = link.reference?.split('/').pop();
        if (endpointId) namesByEndpointId.set(endpointId, resource.name);
      }
    }

    const entries: DirectoryEntry[] = [];
    for (const { resource } of bundle.entry) {
      if (resource?.resourceType !== 'Endpoint') continue;
      if (!resource.id || !resource.address) continue;
      const name =
        namesByEndpointId.get(resource.id) ??
        resource.contained?.[0]?.name ??
        resource.name;
      entries.push({ tenantId: resource.id, name, url: resource.address });
    }
    return entries;
  },

  capabilityUrl(entry: DirectoryEntry): string {
    return `${entry.url}metadata`;
  },

  sandbox(version: FhirVersion): SandboxSeed[] {
    return [SANDBOX[version]];
  },
};
