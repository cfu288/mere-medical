export type DateInfo = { kind: 'known'; iso: string } | { kind: 'unknown' };

export const RECORD_TYPES = [
  'condition',
  'medication',
  'immunization',
  'allergy',
  'encounter',
  'procedure',
  'appointment',
  'coverage',
  'careteam',
  'careplan',
  'order',
  'document',
  'report',
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export type RecordEntry = {
  type: RecordType;
  name: string;
  date: DateInfo;
  dateLabel?: string;
  facts: string[];
};

export function entry(
  type: RecordType,
  name: string,
  date: DateInfo,
  facts: string[],
  dateLabel?: string,
): RecordEntry {
  return { type, name, date, ...(dateLabel ? { dateLabel } : {}), facts };
}

const EPOCH_ISO = new Date(0).toISOString();

export function toDateInfo(date?: string | null): DateInfo {
  if (!date || date === EPOCH_ISO) {
    return { kind: 'unknown' };
  }
  return { kind: 'known', iso: date };
}

export function formatDate(date: DateInfo): string {
  return date.kind === 'known' ? date.iso.slice(0, 10) : 'unknown date';
}

export function compareDateInfoDesc(a: DateInfo, b: DateInfo): number {
  if (a.kind === 'unknown' && b.kind === 'unknown') return 0;
  if (a.kind === 'unknown') return 1;
  if (b.kind === 'unknown') return -1;
  const aMs = Date.parse(a.iso);
  const bMs = Date.parse(b.iso);
  if (Number.isNaN(aMs) && Number.isNaN(bMs)) return b.iso.localeCompare(a.iso);
  if (Number.isNaN(aMs)) return 1;
  if (Number.isNaN(bMs)) return -1;
  return bMs - aMs;
}

export function latestBy<T>(
  items: T[],
  key: (item: T) => string,
  date: (item: T) => DateInfo,
): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const existing = byKey.get(key(item));
    if (!existing || compareDateInfoDesc(date(item), date(existing)) < 0) {
      byKey.set(key(item), item);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    compareDateInfoDesc(date(a), date(b)),
  );
}
