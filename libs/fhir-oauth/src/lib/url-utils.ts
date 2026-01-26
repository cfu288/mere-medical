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
  } else if (fullPath.startsWith(basePath.slice(0, -1))) {
    fullPath = fullPath.slice(basePath.length - 1);
  }

  if (fullPath.startsWith('/')) {
    fullPath = fullPath.slice(1);
  }

  return fullPath + parsedFull.search;
}
