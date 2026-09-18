import type { FhirVersion } from '@mere/shared';
import type { FhirBundle } from './schemas';
import {
  DirectoryEntry,
  DirectorySource,
  SandboxSeed,
  VendorAdapter,
  httpDirectory,
  requireEnv,
} from './types';

const DIRECTORY: Record<FhirVersion, string> = {
  R4: 'EPIC_R4_ENDPOINTS_URL',
  DSTU2: 'EPIC_DSTU2_ENDPOINTS_URL',
};

const SANDBOX: Record<FhirVersion, SandboxSeed> = {
  R4: {
    tenantId: 'sandbox_epic_r4',
    name: 'Epic MyChart Sandbox (R4)',
    url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/',
    token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    authorize: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
  },
  DSTU2: {
    tenantId: 'sandbox_epic',
    name: 'Epic MyChart Sandbox',
    url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/DSTU2/',
    token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    authorize: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
  },
};

export const epicAdapter: VendorAdapter = {
  versions: ['DSTU2', 'R4'],

  directory(version: FhirVersion): DirectorySource | null {
    return httpDirectory(requireEnv(DIRECTORY[version]));
  },

  /**
   * Reads one tenant per Endpoint resource, dropping a health-system name that
   * just repeats the tenant name.
   */
  parseDirectory(bundle: FhirBundle): DirectoryEntry[] {
    const entries: DirectoryEntry[] = [];
    for (const { resource } of bundle.entry) {
      if (resource?.resourceType !== 'Endpoint') continue;
      const address = resource.address;
      if (!address || !resource.id) continue;
      const managingOrganization = resource.managingOrganization?.display;
      entries.push({
        tenantId: resource.id,
        name: resource.name,
        url: address.endsWith('/') ? address : `${address}/`,
        managingOrganization:
          managingOrganization === resource.name
            ? undefined
            : managingOrganization,
      });
    }
    return entries;
  },

  capabilityUrl(entry: DirectoryEntry): string {
    return `${entry.url}metadata`;
  },

  // Unlocks the register uri in metadata, per fhir.epic.com Documentation?docId=oauth2
  capabilityHeaders(): Record<string, string> {
    return { 'Epic-Client-ID': requireEnv('EPIC_CLIENT_ID') };
  },

  sandbox(version: FhirVersion): SandboxSeed[] {
    return [SANDBOX[version]];
  },
};
