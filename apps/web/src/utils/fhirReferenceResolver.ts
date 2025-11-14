export function resolveObservationReferences({
  references,
  baseUrl,
  fallbackBaseUrl,
}: {
  references: Array<{ reference: string }>;
  baseUrl?: string;
  fallbackBaseUrl?: string;
}): string[] {
  const normalizedBaseUrl = (baseUrl || fallbackBaseUrl)?.replace(/\/$/, '');

  return references.map((item) => {
    if (item.reference.startsWith('http')) {
      return item.reference;
    }
    return normalizedBaseUrl
      ? `${normalizedBaseUrl}/${item.reference}`
      : item.reference;
  });
}
