import type { FhirVersion } from '@mere/shared';
import type { FhirBundle } from './schemas';
import {
  DirectoryEntry,
  DirectorySource,
  SandboxSeed,
  VendorAdapter,
  httpDirectory,
} from './types';

const BUNDLE_URL =
  'https://service-base-urls.api.fhir.athena.io/athena-fhir-service-base-urls.json';

const PRACTICE_EXTENSION_URL =
  'https://fhir.athena.io/StructureDefinition/ah-practice';

/**
 * Every practice shares this base url. The practice itself is picked after
 * login by query param.
 */
const ATHENA_FHIR_BASE_URL = 'https://api.platform.athenahealth.com/fhir/r4';

export const athenaAdapter: VendorAdapter = {
  versions: ['R4'],

  directory(version: FhirVersion): DirectorySource | null {
    if (version !== 'R4') return null;
    return httpDirectory(process.env['ATHENA_ENDPOINTS_URL'] ?? BUNDLE_URL);
  },

  /**
   * Groups the bundle's Organization resources by their practice id and returns one
   * tenant per practice. Each carries the practice id, the shared athena base url, and
   * a name only when every Organization in the practice agrees on one.
   */
  parseDirectory(bundle: FhirBundle): DirectoryEntry[] {
    const namesByPractice = new Map<string, Set<string>>();
    for (const { resource } of bundle.entry) {
      if (resource?.resourceType !== 'Organization') continue;
      const practiceExtension = resource.extension?.find(
        (extension) => extension.url === PRACTICE_EXTENSION_URL,
      );
      const practiceId =
        practiceExtension?.valueReference?.reference?.split('Practice-')[1];
      if (!practiceId) continue;

      const names = namesByPractice.get(practiceId) ?? new Set<string>();
      if (resource.name) names.add(resource.name);
      namesByPractice.set(practiceId, names);
    }

    return [...namesByPractice.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([practiceId, names]) => ({
        tenantId: practiceId,
        name: names.size === 1 ? [...names][0] : undefined,
        url: ATHENA_FHIR_BASE_URL,
      }));
  },

  capabilityUrl(): null {
    return null;
  },

  sandbox(): SandboxSeed[] {
    return [];
  },
};
