import type { FhirVersion } from '@mere/shared';
import type { FhirBundle } from './schemas';
import {
  DirectoryEntry,
  DirectorySource,
  SandboxSeed,
  VendorAdapter,
  fileDirectory,
  httpDirectory,
} from './types';

const PRACTICE_LIST_URL =
  'https://fhir.eclinicalworks.com/ecwopendev/external/practiceList';

const SANDBOX: SandboxSeed[] = [
  {
    tenantId: 'sandbox_healow',
    name: 'Healow Sandbox (eClinicalWorks)',
    url: 'https://fhir4.eclinicalworks.com/fhir/r4/JAFJCD',
    token: 'https://oauthserver.eclinicalworks.com/oauth/oauth2/token',
    authorize: 'https://oauthserver.eclinicalworks.com/oauth/oauth2/authorize',
  },
];

export const healowAdapter: VendorAdapter = {
  versions: ['R4'],

  directory(version: FhirVersion): DirectorySource | null {
    if (version !== 'R4') return null;
    const file = process.env['HEALOW_R4_FILE_LOCATION'];
    if (file) return fileDirectory(file);
    return httpDirectory(
      process.env['HEALOW_R4_ENDPOINTS_URL'] ?? PRACTICE_LIST_URL,
    );
  },

  /** Reads one tenant per Endpoint in the practice list, preferring the matching Organization's name. */
  parseDirectory(bundle: FhirBundle): DirectoryEntry[] {
    const names = new Map<string, string>();
    for (const { resource } of bundle.entry) {
      if (resource?.resourceType === 'Organization' && resource.id) {
        if (resource.name) names.set(resource.id, resource.name);
      }
    }

    const entries: DirectoryEntry[] = [];
    for (const { resource } of bundle.entry) {
      if (resource?.resourceType !== 'Endpoint') continue;
      if (!resource.id || !resource.address) continue;
      entries.push({
        tenantId: resource.id,
        name: names.get(resource.id) ?? resource.name,
        url: resource.address,
      });
    }
    return entries;
  },

  capabilityUrl(entry: DirectoryEntry): string {
    return entry.url.endsWith('/')
      ? `${entry.url}metadata`
      : `${entry.url}/metadata`;
  },

  sandbox(): SandboxSeed[] {
    return SANDBOX;
  },
};
