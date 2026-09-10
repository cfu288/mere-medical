import * as fs from 'node:fs';
import type { FhirVersion } from '@mere/shared';
import type { FhirBundle } from './schemas';

/** One tenant a directory lists: its id, base url, and any names the page carried. */
export interface DirectoryEntry {
  tenantId: string;
  name?: string;
  url: string;
  /** Name of the health system this tenant belongs to, when the directory carries one. */
  managingOrganization?: string;
}

/** A sandbox tenant an adapter ships as-is, auth urls and all, with no directory or capability download behind it. */
export interface SandboxSeed {
  tenantId: string;
  name: string;
  url: string;
  token?: string;
  authorize?: string;
}

/** Fetches the raw body of a directory, wherever it lives. */
export interface DirectorySource {
  fetch(signal: AbortSignal): Promise<string>;
}

/** How the pipeline talks to one vendor: its directories, how to read them, and its sandbox tenants. */
export interface VendorAdapter {
  versions: FhirVersion[];
  /** Where this vendor's directory for a version lives, or null if it publishes none. */
  directory(version: FhirVersion): DirectorySource | null;
  /** Reads a fetched directory body into candidate tenants. */
  parseDirectory(bundle: FhirBundle): DirectoryEntry[];
  /** CapabilityStatement location, or null when the vendor exposes no per-tenant one. */
  capabilityUrl(entry: DirectoryEntry): string | null;
  /** Extra headers a vendor needs on capability fetches, such as Epic's client id gate. */
  capabilityHeaders?(): Record<string, string>;
  /** Rows this vendor always publishes, independent of its directory. */
  sandbox(version: FhirVersion): SandboxSeed[];
}

/** Vendors disagree on the FHIR json media type, and eCW serves only plain json. */
export const FHIR_ACCEPT =
  'application/json+fhir, application/fhir+json, application/json';

/** A directory fetched from a url; any non-ok answer throws `HTTP <status>`. */
export function httpDirectory(url: string): DirectorySource {
  return {
    async fetch(signal) {
      const response = await fetch(url, {
        headers: { Accept: FHIR_ACCEPT },
        signal,
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return body;
    },
  };
}

export function fileDirectory(filePath: string): DirectorySource {
  return {
    async fetch() {
      return fs.readFileSync(filePath, 'utf8');
    },
  };
}
