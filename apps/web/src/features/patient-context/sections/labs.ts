import {
  BundleEntry,
  DiagnosticReport,
  FhirResource,
  Observation,
} from 'fhir/r2';

import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
} from '../../../models/clinical-document/ClinicalDocument.type';
import { observationIdCandidates } from '../../../shared/utils/fhirReferenceResolver';
import {
  groupIdenticalLabRecords,
  labAnalyteKey,
  labValueText,
} from '../../../shared/utils/labResults';
import {
  getValueUnit,
  isOutOfRangeResult,
} from '../../timeline/utils/fhirpathParsers';
import { compareDateInfoDesc, DateInfo, toDateInfo } from '../types';

type Doc = ClinicalDocument<BundleEntry<FhirResource>>;
type LabDoc = ClinicalDocument<BundleEntry<Observation>>;
type ByType = Map<ClinicalDocumentResourceType, Doc[]>;

export type LabIndexEntry = {
  names: string[];
  code?: string;
  panelNames: string[];
  results: {
    display: string;
    unit?: string;
    abnormal: boolean;
    date: DateInfo;
  }[];
};

/** Every id the observations of a diagnostic report may be stored under. */
export function reportObservationRefs(
  report: Doc,
  connectionLocations: Map<string, string>,
): string[] {
  const resource = report.data_record.raw?.resource as
    | DiagnosticReport
    | undefined;
  return observationIdCandidates({
    references: (resource?.result ?? []).filter(
      (r): r is { reference: string } => Boolean(r.reference),
    ),
    baseUrl: connectionLocations.get(report.connection_record_id),
  });
}

export function buildLabIndex(
  byType: ByType,
  connectionLocations: Map<string, string>,
): LabIndexEntry[] {
  const panelByObsId = new Map<string, string>();
  for (const report of byType.get('diagnosticreport') ?? []) {
    const panelName = report.metadata?.display_name;
    if (!panelName) {
      continue;
    }
    for (const id of reportObservationRefs(report, connectionLocations)) {
      panelByObsId.set(`${report.connection_record_id}|${id}`, panelName);
    }
  }

  const byAnalyte = new Map<string, LabDoc[][]>();
  for (const group of groupIdenticalLabRecords(
    (byType.get('observation') ?? []) as LabDoc[],
  )) {
    const key = labAnalyteKey(group[0]);
    const groups = byAnalyte.get(key);
    if (groups) {
      groups.push(group);
    } else {
      byAnalyte.set(key, [group]);
    }
  }

  return [...byAnalyte.values()].map((groups) => {
    const newestFirst = [...groups].sort((a, b) =>
      compareDateInfoDesc(
        toDateInfo(a[0].metadata?.date),
        toDateInfo(b[0].metadata?.date),
      ),
    );
    const docs = newestFirst.flat();
    return {
      names: [...new Set(docs.map(nameOf))],
      code: docs[0].metadata?.loinc_coding?.[0],
      panelNames: [
        ...new Set(
          docs.flatMap((doc) => {
            const panel = panelByObsId.get(
              `${doc.connection_record_id}|${doc.metadata?.id ?? ''}`,
            );
            return panel ? [panel] : [];
          }),
        ),
      ],
      results: newestFirst.map((group) => ({
        display: labValueText(group[0]) ?? 'no value',
        unit: getValueUnit(group[0]),
        abnormal: isOutOfRangeResult(group[0]),
        date: toDateInfo(group[0].metadata?.date),
      })),
    };
  });
}

function nameOf(doc: LabDoc): string {
  return (
    doc.metadata?.display_name ??
    doc.data_record.raw?.resource?.code?.text ??
    doc.metadata?.loinc_coding?.[0] ??
    'Unnamed result'
  );
}
