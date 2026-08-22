/**
 * Extracts the resource path of an absolute FHIR URL relative to a server's base.
 *
 * Epic returns Bundle `next` links as absolute URLs, but the proxy only accepts
 * a path to forward (`target=Patient?page=2`). The string alternative,
 * `fullUrl.replace(baseUrl, '')`, silently returns the whole absolute URL when
 * the two differ by so much as a trailing slash, and that garbage becomes the
 * proxy target.
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
 * Like {@link extractRelativeFhirPath}, but first answers whether the URL is
 * under the base at all - null means it points somewhere the proxy cannot
 * forward to, since the proxy only routes paths under the tenant's base.
 *
 * Raw string prefix checks get the boundary wrong: '/api/FHIR/R4' is a string
 * prefix of '/api/FHIR/R40/Patient' but not a parent path of it.
 *
 * @example
 * relativeFhirPathWithin(
 *   'https://cdn.example/document.pdf',
 *   'https://tenant.example/api/FHIR/R4/'
 * ) // Returns: null
 */
export function relativeFhirPathWithin(
  fullUrl: string,
  fhirBaseUrl: string,
): string | null {
  const parsedBase = new URL(fhirBaseUrl),
    parsedFull = new URL(fullUrl, fhirBaseUrl);

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
 * Joins a resource path onto a FHIR base URL without losing the base's path.
 *
 * Epic tenants publish bases with deep path prefixes, e.g.
 * `https://webprd.ochin.org/prd-fhir/MyChartAACI/api/FHIR/R4/`, and both raw
 * alternatives corrupt them: `new URL('/Patient', base)` resolves from the
 * origin and drops the whole prefix, and when the base has no trailing slash
 * `new URL('Patient', base)` replaces the last path segment instead of
 * appending. String concatenation doubles or drops slashes and leaves query
 * encoding to every caller.
 *
 * @example
 * resolveFhirUrl('https://webprd.ochin.org/prd-fhir/MyChartAACI/api/FHIR/R4', '/Patient')
 * // Returns: 'https://webprd.ochin.org/prd-fhir/MyChartAACI/api/FHIR/R4/Patient'
 */
export function resolveFhirUrl(
  fhirBaseUrl: string,
  resourcePath: string,
  params?: URLSearchParams,
): string {
  const base = fhirBaseUrl.endsWith('/') ? fhirBaseUrl : `${fhirBaseUrl}/`,
    relativePath = resourcePath.startsWith('/')
      ? resourcePath.slice(1)
      : resourcePath,
    url = new URL(relativePath, base),
    query = params?.toString();
  if (query) {
    url.search = query;
  }

  return url.toString();
}

/**
 * Derives Epic's dynamic client registration endpoint, which no catalog
 * publishes, as a sibling of the authorize endpoint.
 *
 * Deriving it from the FHIR base instead (strip `/api/FHIR/R4`, append
 * `/oauth2/register`) picks the wrong server whenever a tenant hosts FHIR and
 * OAuth on different paths or hosts - true for 119 of the 1276 tenants in
 * Epic's catalog, e.g. Kaiser serves FHIR from a routing-service path but
 * OAuth from its portal path.
 *
 * @example
 * deriveRegistrationUrl('https://fhir.kp.org/KPPolarisPortal/esb-envlbl/190/oauth2/authorize')
 * // Returns: 'https://fhir.kp.org/KPPolarisPortal/esb-envlbl/190/oauth2/register'
 */
export function deriveRegistrationUrl(authorizeUrl: string): string {
  const url = new URL('register', authorizeUrl);
  url.search = '';
  return url.toString();
}
