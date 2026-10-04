import { concatPath } from './urlUtils';

export function resolveObservationReferences({
  references,
  baseUrl,
}: {
  references: Array<{ reference: string }>;
  baseUrl?: string;
}): string[] {
  return references.map((item) => {
    if (item.reference.startsWith('http')) {
      return item.reference;
    }
    return baseUrl ? concatPath(baseUrl, item.reference) : item.reference;
  });
}

/**
 * Every id an observation may be stored under for the references of a report.
 *
 * Health systems store an observation's `metadata.id` either exactly as the
 * report wrote the reference (onpatient: `Observation/abc`) or resolved to a
 * full url (Epic, Cerner: `https://host/fhir/Observation/abc`). Returning both
 * forms lets one query match whichever the sync stored. Duplicates are removed
 * and the as-written forms come first, in input order.
 *
 * @param params.references Entries of `DiagnosticReport.result`, each with its `reference` string.
 * @param params.baseUrl The connection's FHIR base url; when absent, relative references are returned as written only.
 * @returns Candidate `metadata.id` values to match with `$in`.
 * @example
 * observationIdCandidates({
 *   references: [
 *     { reference: 'Observation/abc' },
 *     { reference: 'https://b.example.com/fhir/Observation/xyz' },
 *   ],
 *   baseUrl: 'https://a.example.com/fhir',
 * });
 * // [
 * //   'Observation/abc',
 * //   'https://b.example.com/fhir/Observation/xyz',
 * //   'https://a.example.com/fhir/Observation/abc',
 * // ]
 */
export function observationIdCandidates(params: {
  references: Array<{ reference: string }>;
  baseUrl?: string;
}): string[] {
  return [
    ...new Set([
      ...params.references.map((item) => item.reference),
      ...resolveObservationReferences(params),
    ]),
  ];
}
