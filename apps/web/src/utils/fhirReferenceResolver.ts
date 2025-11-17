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
