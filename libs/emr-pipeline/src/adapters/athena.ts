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
    return httpDirectory(requireEnv('ATHENA_ENDPOINTS_URL'));
  },

  /**
   * Athena's directory lists Organization resources, the locations and
   * departments inside practices. What a user connects to is the practice,
   * selected at login by its practice id. This returns that connectable
   * list, one tenant per practice, sorted by practice id. An Organization
   * belongs to a practice through its `ah-practice` extension, whose
   * reference `Practice-10` yields the practice id `10`. Organizations
   * without that extension are skipped. Every tenant gets the shared athena
   * base url. The name is the single name the practice's Organizations agree
   * on, and undefined when they disagree or none carries a name.
   *
   * @example
   * Two Organizations referencing `Practice-10`, both named
   * `Anchor Medical Associates`, plus one nameless Organization referencing
   * `Practice-21260`, become:
   *
   *   [
   *     { tenantId: '10', name: 'Anchor Medical Associates',
   *       url: 'https://api.platform.athenahealth.com/fhir/r4' },
   *     { tenantId: '21260', name: undefined,
   *       url: 'https://api.platform.athenahealth.com/fhir/r4' },
   *   ]
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

  metadataUrl(): null {
    return null;
  },

  sandbox(): SandboxSeed[] {
    return [];
  },
};
