/**
 * Extracts the relative resource path from a FHIR pagination URL.
 *
 * FHIR Bundle `next` links are absolute URLs that include the full FHIR base path.
 * When proxying requests, we need just the resource path relative to the FHIR base.
 *
 * @example
 * extractRelativeFhirPath(
 *   'https://fhir.epic.com/api/FHIR/R4/Patient?page=2',
 *   'https://fhir.epic.com/api/FHIR/R4/'
 * ) // Returns: 'Patient?page=2'
 */
export function extractRelativeFhirPath(
  fullUrl: string,
  fhirBaseUrl: string,
): string {
  const parsedBase = new URL(fhirBaseUrl);
  const parsedFull = new URL(fullUrl, fhirBaseUrl);

  let basePath = parsedBase.pathname;
  if (!basePath.endsWith('/')) {
    basePath += '/';
  }

  let fullPath = parsedFull.pathname;

  if (fullPath.startsWith(basePath)) {
    fullPath = fullPath.slice(basePath.length);
  } else if (fullPath === basePath.slice(0, -1)) {
    fullPath = '';
  }

  if (fullPath.startsWith('/')) {
    fullPath = fullPath.slice(1);
  }

  return fullPath + parsedFull.search;
}

/**
 * Returns the resource path of a URL relative to a FHIR base, or null when the
 * URL points somewhere else entirely.
 *
 * Servers hand out absolute links to other hosts (CDN-backed attachments), and
 * those must not be rewritten as if they sat under the FHIR base.
 */
export function relativeFhirPathWithin(
  fullUrl: string,
  fhirBaseUrl: string,
): string | null {
  const parsedBase = new URL(fhirBaseUrl);
  const parsedFull = new URL(fullUrl, fhirBaseUrl);

  if (parsedFull.origin !== parsedBase.origin) {
    return null;
  }

  const basePath = parsedBase.pathname.endsWith('/')
    ? parsedBase.pathname
    : `${parsedBase.pathname}/`;

  if (
    !parsedFull.pathname.startsWith(basePath) &&
    parsedFull.pathname !== basePath.slice(0, -1)
  ) {
    return null;
  }

  return extractRelativeFhirPath(fullUrl, fhirBaseUrl);
}

/**
 * Resolves a FHIR resource path against a server's base URL.
 *
 * The resource path is always resolved relative to the full base URL, so path
 * prefixes above the FHIR base (proxies, per-tenant mount points) survive.
 */
export function resolveFhirUrl(
  fhirBaseUrl: string,
  resourcePath: string,
  params?: URLSearchParams,
): string {
  const base = fhirBaseUrl.endsWith('/') ? fhirBaseUrl : `${fhirBaseUrl}/`;
  const relativePath = resourcePath.startsWith('/')
    ? resourcePath.slice(1)
    : resourcePath;

  const url = new URL(relativePath, base);
  const query = params?.toString();
  if (query) {
    url.search = query;
  }

  return url.toString();
}

/**
 * Derives a SMART dynamic client registration endpoint from an authorization
 * endpoint, which sits alongside it on the same authorization server.
 */
export function deriveRegistrationUrl(authorizeUrl: string): string {
  const url = new URL('register', authorizeUrl);
  url.search = '';
  return url.toString();
}
