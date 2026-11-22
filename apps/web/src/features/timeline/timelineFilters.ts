import { addDays, format, parseISO, subYears } from 'date-fns';
import { ClinicalDocumentResourceType } from '../../models/clinical-document/ClinicalDocument.type';
import { RecordsByDate } from './types';

export const TIMELINE_CATEGORIES = [
  {
    key: 'labs',
    label: 'Labs',
    dot: 'bg-blue-600',
    types: ['observation', 'diagnosticreport'],
  },
  { key: 'visits', label: 'Visits', dot: 'bg-amber-600', types: ['encounter'] },
  {
    key: 'medications',
    label: 'Medications',
    dot: 'bg-green-600',
    types: [
      'medication',
      'medicationstatement',
      'medicationrequest',
      'medicationorder',
      'medicationdispense',
      'medicationadministration',
    ],
  },
  {
    key: 'immunizations',
    label: 'Immunizations',
    dot: 'bg-purple-600',
    types: ['immunization'],
  },
  {
    key: 'conditions',
    label: 'Conditions',
    dot: 'bg-red-600',
    types: ['condition'],
  },
  {
    key: 'allergies',
    label: 'Allergies',
    dot: 'bg-orange-600',
    types: ['allergyintolerance'],
  },
  {
    key: 'procedures',
    label: 'Procedures',
    dot: 'bg-sky-600',
    types: ['procedure'],
  },
  {
    key: 'documents',
    label: 'Documents',
    dot: 'bg-teal-600',
    types: ['documentreference'],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    dot: 'bg-indigo-600',
    types: ['appointment'],
  },
  {
    key: 'coverage',
    label: 'Coverage',
    dot: 'bg-gray-600',
    types: ['coverage'],
  },
  { key: 'devices', label: 'Devices', dot: 'bg-gray-600', types: ['device'] },
  {
    key: 'careteams',
    label: 'Care teams',
    dot: 'bg-gray-600',
    types: ['careteam'],
  },
  { key: 'goals', label: 'Goals', dot: 'bg-gray-600', types: ['goal'] },
  {
    key: 'specimens',
    label: 'Specimens',
    dot: 'bg-gray-600',
    types: ['specimen'],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  dot: string;
  types: readonly ClinicalDocumentResourceType[];
}[];

export type TimelineCategoryKey = (typeof TIMELINE_CATEGORIES)[number]['key'];

export const DATE_PRESETS = [
  { label: 'Any time', years: 0 },
  { label: 'Past year', years: 1 },
  { label: 'Past 2 years', years: 2 },
] as const;

/** `from` and `to` are inclusive `yyyy-MM-dd` days; missing means open-ended. */
export interface TimelineFilters {
  categories: TimelineCategoryKey[];
  from?: string;
  to?: string;
}

export const NO_FILTERS: TimelineFilters = { categories: [] };

export function presetFrom(years: number, today = new Date()) {
  return years ? format(subYears(today, years), 'yyyy-MM-dd') : undefined;
}

export function activeFilterCount(f: TimelineFilters) {
  return f.categories.length + (f.from || f.to ? 1 : 0);
}

// metadata.date holds raw FHIR text (UTC or offset timestamps, date-only or
// partial dates like '2024-02'), while the timeline shows each record on its
// local day. Text bounds can't match local days exactly, so the query reads
// two extra days on each side and filterDaysInRange trims to the exact range.
const DATE_SLACK_DAYS = 2;
const shiftDay = (day: string, days: number) =>
  format(addDays(parseISO(day), days), 'yyyy-MM-dd');

export function toTimelineQuery(f: TimelineFilters) {
  return {
    types: TIMELINE_CATEGORIES.filter((c) =>
      f.categories.includes(c.key),
    ).flatMap((c) => [...c.types]),
    dateFrom: f.from ? shiftDay(f.from, -DATE_SLACK_DAYS) : undefined,
    dateBefore: f.to ? shiftDay(f.to, 1 + DATE_SLACK_DAYS) : undefined,
  };
}

export function filterDaysInRange(
  data: RecordsByDate | undefined,
  f: TimelineFilters,
): RecordsByDate | undefined {
  if (!data || (!f.from && !f.to)) return data;
  return Object.fromEntries(
    Object.entries(data).filter(
      ([day]) => (!f.from || day >= f.from) && (!f.to || day <= f.to),
    ),
  );
}

export function dateRangeLabel(f: TimelineFilters, today = new Date()) {
  if (!f.from && !f.to) return undefined;
  const preset = DATE_PRESETS.find(
    (p) => p.years && !f.to && f.from === presetFrom(p.years, today),
  );
  if (preset) return preset.label;
  const day = (d: string) => format(parseISO(d), 'MMM d, yyyy');
  if (!f.to) return `Since ${day(f.from as string)}`;
  if (!f.from) return `Until ${day(f.to)}`;
  return `${day(f.from)} – ${day(f.to)}`;
}
