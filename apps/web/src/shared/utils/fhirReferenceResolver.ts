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

/** Every id an observation may be stored under for these references: as written, and resolved against the connection. */
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
