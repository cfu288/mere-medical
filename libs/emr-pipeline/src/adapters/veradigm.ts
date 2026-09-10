import type { FhirVersion } from '@mere/shared';
import type { FhirBundle } from './schemas';
import {
  DirectoryEntry,
  DirectorySource,
  SandboxSeed,
  VendorAdapter,
  httpDirectory,
} from './types';

const SANDBOX: SandboxSeed[] = [
  {
    tenantId: 'sandbox_veradigm',
    name: 'Veradigm Sandbox (Professional)',
    url: 'https://fhir.fhirpoint.open.allscripts.com/fhirroute/fhir/CustProProdSand201SMART/',
    token:
      'https://fhir.fhirpoint.open.allscripts.com/fhirroute/authorization/CustProProdSand201SMART/connect/token',
    authorize:
      'https://fhir.fhirpoint.open.allscripts.com/fhirroute/authorization/CustProProdSand201SMART/connect/authorize',
  },
  {
    tenantId: 'sandbox_touchworks',
    name: 'TouchWorks Sandbox (Offline)',
    url: 'https://tw181unityfhir.open.allscripts.com/open/',
    token:
      'https://open.allscripts.com/fhirroute/patientauth/e75746a4-7f05-4b95-9ff5-44082c988959/connect/token/',
    authorize:
      'https://open.allscripts.com/fhirroute/patientauth/e75746a4-7f05-4b95-9ff5-44082c988959/connect/authorize/',
  },
];

const DIRECTORY: Record<FhirVersion, { env: string; url: string | null }> = {
  R4: { env: 'VERADIGM_R4_ENDPOINTS_URL', url: null },
  DSTU2: {
    env: 'VERADIGM_DSTU2_ENDPOINTS_URL',
    url: 'https://open.platform.veradigm.com/fhirendpoints/download/DSTU2',
  },
};

export const veradigmAdapter: VendorAdapter = {
  versions: ['DSTU2', 'R4'],

  directory(version: FhirVersion): DirectorySource | null {
    const source = DIRECTORY[version];
    const url = process.env[source.env] ?? source.url;
    return url ? httpDirectory(url) : null;
  },

  /**
   * Reads one tenant per entry, taking its id and name from the contained
   * Organization.
   */
  parseDirectory(bundle: FhirBundle): DirectoryEntry[] {
    const entries: DirectoryEntry[] = [];
    for (const { resource } of bundle.entry) {
      const contained = resource?.contained?.[0];
      const address = resource?.address;
      if (!contained?.id || !address) continue;
      entries.push({
        tenantId: contained.id,
        name: contained.name ?? resource.name,
        url: address.endsWith('/') ? address : `${address}/`,
      });
    }
    return entries;
  },

  capabilityUrl(entry: DirectoryEntry): string {
    return `${entry.url}metadata`;
  },

  sandbox(version: FhirVersion): SandboxSeed[] {
    return version === 'DSTU2' ? SANDBOX : [];
  },
};
