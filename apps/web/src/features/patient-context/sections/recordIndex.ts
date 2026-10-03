import { ClinicalDocumentResourceType } from '../../../models/clinical-document/ClinicalDocument.type';
import { ClinicalDoc } from '../clinicalDocs';
import { NoteRecord } from '../notes/noteRecord';
import {
  compareDateInfoDesc,
  entry,
  formatDate,
  RecordEntry,
  toDateInfo,
} from '../types';
import { buildConditionEntries } from './conditions';
import { buildEncounterEntries } from './encounters';
import {
  buildAllergyEntries,
  buildImmunizationEntries,
} from './immunizationsAllergies';
import { reportObservationRefs } from './labs';
import { buildMedicationEntries, MEDICATION_TYPES } from './medications';

export type RecordIndex = {
  entries: RecordEntry[];
  alsoOnRecord: { type: string; count: number }[];
};

type RawResource = {
  id?: string;
  status?: string;
  intent?: string;
  start?: string;
  description?: string;
  authoredOn?: string;
  performedDateTime?: string;
  performedPeriod?: { start?: string };
  type?: { text?: string };
  code?: { text?: string };
  category?: { text?: string }[];
  period?: { start?: string; end?: string };
  payor?: { reference?: string; display?: string }[];
  participant?: {
    role?: { text?: string }[];
    member?: { display?: string };
  }[];
  result?: { reference?: string }[];
};

const HANDLED_TYPES = new Set<ClinicalDocumentResourceType>([
  ...MEDICATION_TYPES,
  'condition',
  'immunization',
  'allergyintolerance',
  'encounter',
  'procedure',
  'appointment',
  'coverage',
  'careteam',
  'careplan',
  'servicerequest',
  'documentreference',
  'documentreference_attachment',
  'diagnosticreport',
  'observation',
]);

const INFRA_TYPES = new Set<ClinicalDocumentResourceType>([
  'patient',
  'practitioner',
  'practitionerrole',
  'organization',
  'location',
  'provenance',
  'specimen',
  'person',
  'relatedperson',
  'schedule',
  'slot',
]);

export function buildRecordIndex(
  byType: Map<ClinicalDocumentResourceType, ClinicalDoc[]>,
  connectionLocations: Map<string, string>,
  notes: NoteRecord[],
): RecordIndex {
  const get = (type: ClinicalDocumentResourceType) => byType.get(type) ?? [];

  const entries: RecordEntry[] = [
    ...buildConditionEntries(get('condition')),
    ...buildMedicationEntries(MEDICATION_TYPES.flatMap(get)),
    ...buildImmunizationEntries(get('immunization')),
    ...buildAllergyEntries(get('allergyintolerance')),
    ...buildEncounterEntries(get('encounter')),
    ...get('procedure').flatMap(procedureEntry),
    ...get('appointment').flatMap(appointmentEntry),
    ...get('coverage').map((doc) => coverageEntry(doc, get('organization'))),
    ...get('careteam').map(careteamEntry),
    ...get('careplan').map(careplanEntry),
    ...get('servicerequest').flatMap(orderEntry),
    ...notes.map((note) =>
      entry('document', note.displayName, note.date, [
        `read the text with read_note ${note.alias}`,
      ]),
    ),
    ...reportEntries(
      get('diagnosticreport'),
      get('observation'),
      connectionLocations,
    ),
  ].sort(
    (a, b) =>
      compareDateInfoDesc(a.date, b.date) || a.name.localeCompare(b.name),
  );

  return { entries, alsoOnRecord: alsoOnRecord(byType) };
}

function raw(doc: ClinicalDoc): RawResource | undefined {
  return doc.data_record.raw?.resource as RawResource | undefined;
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}

function procedureEntry(doc: ClinicalDoc): RecordEntry[] {
  const resource = raw(doc);
  const name = doc.metadata?.display_name ?? resource?.code?.text;
  if (!name) {
    return [];
  }
  const date = toDateInfo(
    resource?.performedDateTime ??
      resource?.performedPeriod?.start ??
      doc.metadata?.date,
  );
  return [entry('procedure', name, date, statusFacts(resource))];
}

function appointmentEntry(doc: ClinicalDoc): RecordEntry[] {
  const resource = raw(doc);
  const name = doc.metadata?.display_name ?? resource?.description;
  if (!name) {
    return [];
  }
  const date = toDateInfo(resource?.start ?? doc.metadata?.date);
  return [entry('appointment', name, date, statusFacts(resource))];
}

function coverageEntry(
  doc: ClinicalDoc,
  organizations: ClinicalDoc[],
): RecordEntry {
  const resource = raw(doc);
  const name = resource?.type?.text ?? doc.metadata?.display_name ?? 'Coverage';
  const start = resource?.period?.start;
  const date = toDateInfo(start ?? doc.metadata?.date);
  const dateLabel = start
    ? `${start}..${resource?.period?.end ?? 'present'}`
    : undefined;
  const payor = resource?.payor?.[0];
  const payer =
    payor?.display ??
    (payor?.reference
      ? resolvePayerOrg(
          payor.reference,
          doc.connection_record_id,
          organizations,
        )
      : undefined);
  return entry('coverage', name, date, payer ? [payer] : [], dateLabel);
}

function resolvePayerOrg(
  reference: string,
  connectionRecordId: string,
  organizations: ClinicalDoc[],
): string | undefined {
  const match = organizations.find(
    (org) =>
      org.connection_record_id === connectionRecordId &&
      (org.metadata?.id === reference ||
        org.metadata?.id?.endsWith(`/${reference}`)),
  );
  return match?.metadata?.display_name;
}

function careteamEntry(doc: ClinicalDoc): RecordEntry {
  const resource = raw(doc);
  const displayName = doc.metadata?.display_name;
  const name =
    (displayName !== resource?.id ? displayName : undefined) ??
    resource?.category?.[0]?.text ??
    'Care team';
  const members = (resource?.participant ?? [])
    .map((participant) => {
      const member = participant.member?.display;
      const role = participant.role?.[0]?.text;
      return member ? (role ? `${member} (${role})` : member) : undefined;
    })
    .filter(isPresent);
  return entry('careteam', name, toDateInfo(doc.metadata?.date), members);
}

function careplanEntry(doc: ClinicalDoc): RecordEntry {
  const resource = raw(doc);
  const name =
    doc.metadata?.display_name ?? resource?.category?.[0]?.text ?? 'Care plan';
  return entry(
    'careplan',
    name,
    toDateInfo(doc.metadata?.date),
    statusFacts(resource),
  );
}

function orderEntry(doc: ClinicalDoc): RecordEntry[] {
  const resource = raw(doc);
  const name = doc.metadata?.display_name ?? resource?.code?.text;
  if (!name) {
    return [];
  }
  const date = toDateInfo(resource?.authoredOn ?? doc.metadata?.date);
  return [
    entry(
      'order',
      name,
      date,
      [resource?.status, resource?.intent].filter(isPresent),
    ),
  ];
}

function statusFacts(resource: RawResource | undefined): string[] {
  return resource?.status ? [resource.status] : [];
}

function reportEntries(
  diagnosticReports: ClinicalDoc[],
  observations: ClinicalDoc[],
  connectionLocations: Map<string, string>,
): RecordEntry[] {
  const observationIds = new Set(
    observations
      .filter((obs) => isPresent(obs.metadata?.id))
      .map((obs) => `${obs.connection_record_id}|${obs.metadata?.id}`),
  );
  const reports = diagnosticReports.flatMap((report) => {
    const name = report.metadata?.display_name;
    if (!name) {
      return [];
    }
    const candidates = reportObservationRefs(report, connectionLocations);
    if (
      candidates.some((ref) =>
        observationIds.has(`${report.connection_record_id}|${ref}`),
      )
    ) {
      return [];
    }
    return [entry('report', name, toDateInfo(report.metadata?.date), [])];
  });
  const unique = new Map<string, RecordEntry>();
  const undated: RecordEntry[] = [];
  for (const report of reports) {
    if (report.date.kind === 'unknown') {
      undated.push(report);
      continue;
    }
    const key = `${report.name.toLowerCase()}|${report.date.iso}`;
    if (!unique.has(key)) {
      unique.set(key, report);
    }
  }
  return [...unique.values(), ...undated];
}

function alsoOnRecord(
  byType: Map<ClinicalDocumentResourceType, ClinicalDoc[]>,
): { type: string; count: number }[] {
  return [...byType.entries()]
    .filter(([type]) => !HANDLED_TYPES.has(type) && !INFRA_TYPES.has(type))
    .map(([type, docs]) => ({ type, count: docs.length }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}
