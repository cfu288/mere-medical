const LOINC_SYSTEM = /^https?:\/\/loinc\.org\/?$/;

export function loincCodes(
  coding: Array<{ system?: string; code?: string }> | undefined,
): string[] {
  return (coding ?? []).flatMap((c) =>
    c.system && LOINC_SYSTEM.test(c.system) && c.code !== undefined
      ? [c.code]
      : [],
  );
}

/** When the result was observed: the effective time, else the start of its period, else when it was issued. */
export function observationDate(resource: {
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string };
  issued?: string;
}): string {
  return (
    resource.effectiveDateTime ||
    resource.effectivePeriod?.start ||
    resource.issued ||
    new Date(0).toISOString()
  );
}
