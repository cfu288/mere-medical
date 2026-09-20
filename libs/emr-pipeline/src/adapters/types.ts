import * as fs from 'node:fs';
import type { FhirVersion } from '@mere/shared';
import type { FhirBundle } from './schemas';

/**
 * One tenant a directory lists, with its id, base url, and any names the page
 * carried.
 */
export interface DirectoryEntry {
  tenantId: string;
  name?: string;
  url: string;
  /**
   * Name of the health system this tenant belongs to, when the directory
   * carries one.
   */
  managingOrganization?: string;
}

/**
 * A sandbox tenant an adapter ships as-is, auth urls and all, with no directory
 * or capability download behind it.
 */
export interface SandboxSeed {
  tenantId: string;
  name: string;
  url: string;
  token: string;
  authorize: string;
}

/** Fetches the raw body of a directory, wherever it lives. */
export interface DirectorySource {
  fetch(): Promise<string>;
}

const DIRECTORY_TIMEOUT_MS = 300_000;

/**
 * How the pipeline talks to one vendor, covering its directories, how to read
 * them, and its sandbox tenants.
 */
export interface VendorAdapter {
  versions: FhirVersion[];
  /**
   * Where this vendor's directory for a version lives, or null if it publishes
   * none.
   */
  directory(version: FhirVersion): DirectorySource | null;
  /** Reads a fetched directory body into candidate tenants. */
  parseDirectory(bundle: FhirBundle): DirectoryEntry[];
  /**
   * The metadata url answering this tenant's CapabilityStatement, or null
   * when the vendor exposes no per-tenant one.
   */
  metadataUrl(entry: DirectoryEntry): string | null;
  /**
   * Extra headers a vendor needs on capability fetches, such as Epic's client
   * id gate.
   */
  capabilityHeaders?(): Record<string, string>;
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

/**
 * A directory source that downloads its body from the url when asked. Any
 * non-ok answer throws.
 */
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

/** A directory source that reads its body from a local file when asked. */
export function fileDirectory(filePath: string): DirectorySource {
  return {
    async fetch() {
      return fs.readFileSync(filePath, 'utf8');
    },
  };
}
