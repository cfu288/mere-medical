import * as fs from 'node:fs';
import type { FhirVersion } from '@mere/shared';
import type { FhirBundle } from './schemas';

/** One tenant parsed from a vendor directory. */
export interface DirectoryEntry {
  tenantId: string;
  name?: string;
  url: string;
  /** The health system this tenant belongs to. Only epic's directory provides it. */
  managingOrganization?: string;
}

/** A hardcoded sandbox tenant, published without a directory listing or capability fetch. */
export interface SandboxSeed {
  tenantId: string;
  name: string;
  url: string;
  token: string;
  authorize: string;
}

/** Supplies a directory body as raw text. */
export interface DirectorySource {
  fetch(): Promise<string>;
}

const DIRECTORY_TIMEOUT_MS = 300_000;

/** One vendor's directory locations, parsing, and sandbox tenants. */
export interface VendorAdapter {
  versions: FhirVersion[];
  /** The directory source for a version, or null when the vendor publishes none. */
  directory(version: FhirVersion): DirectorySource | null;
  /** Reads a parsed directory bundle into tenants. */
  parseDirectory(bundle: FhirBundle): DirectoryEntry[];
  /**
   * The metadata url answering this tenant's CapabilityStatement, or null
   * when the vendor exposes no per-tenant one.
   */
  metadataUrl(entry: DirectoryEntry): string | null;
  /** Extra headers for metadata fetches, like Epic's client id. */
  capabilityHeaders?(): Record<string, string>;
  /** Milliseconds between metadata fetches. Set on vendors whose gateway rejects a fast crawl. */
  requestDelayMs?: number;
  /** Rows this vendor always publishes, independent of its directory. */
  sandbox(version: FhirVersion): SandboxSeed[];
}

/**
 * Vendors disagree on the FHIR json media type, and eCW serves only plain json.
 */
export const FHIR_ACCEPT =
  'application/json+fhir, application/fhir+json, application/json';

/** Reads an env variable or throws when it is not set. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/** Downloads the directory body from the url. A non-ok answer throws. */
export function httpDirectory(url: string): DirectorySource {
  return {
    async fetch() {
      const response = await fetch(url, {
        headers: { Accept: FHIR_ACCEPT },
        signal: AbortSignal.timeout(DIRECTORY_TIMEOUT_MS),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return body;
    },
  };
}

/** Reads the directory body from a local file. */
export function fileDirectory(filePath: string): DirectorySource {
  return {
    async fetch() {
      return fs.readFileSync(filePath, 'utf8');
    },
  };
}
