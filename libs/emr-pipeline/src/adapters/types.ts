import * as fs from 'node:fs';
import type { FhirVersion } from '@mere/shared';
import type { FhirBundle } from './schemas';

export interface DirectoryEntry {
  tenantId: string;
  name?: string;
  url: string;
  /** The health system this tenant belongs to, named, and only when it differs from it. */
  managingOrganization?: string;
}

export interface SandboxSeed {
  tenantId: string;
  name: string;
  url: string;
  token?: string;
  authorize?: string;
}

/** A response the server answered but that carries no document, such as 404 or 403. */
export class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpStatusError';
  }
}

export interface DirectorySource {
  fetch(signal: AbortSignal): Promise<string>;
}

export interface VendorAdapter {
  versions: FhirVersion[];
  /** Where this vendor's catalog for a version lives, or null if it publishes none. */
  directory(version: FhirVersion): DirectorySource | null;
  /** Reads a fetched directory body into candidate tenants. */
  parseDirectory(bundle: FhirBundle): DirectoryEntry[];
  /** CapabilityStatement location, or null when the vendor exposes no per-tenant one. */
  capabilityUrl(entry: DirectoryEntry): string | null;
  /** Extra headers a vendor needs on capability fetches, such as Epic's client id gate. */
  capabilityHeaders?(): Record<string, string>;
  /** Rows this vendor always publishes, independent of its catalog. */
  sandbox(version: FhirVersion): SandboxSeed[];
}

/** Vendors disagree on the FHIR json media type, and eCW serves only plain json. */
export const FHIR_ACCEPT =
  'application/json+fhir, application/fhir+json, application/json';

export function httpDirectory(url: string): DirectorySource {
  return {
    async fetch(signal) {
      const response = await fetch(url, {
        headers: { Accept: FHIR_ACCEPT },
        signal,
      });
      const body = await response.text();
      if (!response.ok) {
        throw new HttpStatusError(response.status);
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
