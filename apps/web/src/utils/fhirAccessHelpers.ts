import { BundleEntry as DSTU2BundleEntry } from 'fhir/r2';
import { BundleEntry as R4BundleEntry, Encounter as R4Encounter, DiagnosticReport as R4DiagnosticReport, Observation as R4Observation, Procedure as R4Procedure } from 'fhir/r4';
import { Encounter as DSTU2Encounter, DiagnosticReport as DSTU2DiagnosticReport, Observation as DSTU2Observation, Procedure as DSTU2Procedure } from 'fhir/r2';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';

export function getEncounterClass(
  document: ClinicalDocument,
): string | undefined {
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (document.data_record.raw as R4BundleEntry<R4Encounter>)?.resource;
      return resource?.class?.code;
    }
    case 'FHIR.DSTU2': {
      const resource = (document.data_record.raw as DSTU2BundleEntry<DSTU2Encounter>)?.resource;
      return resource?.class;
    }
    default:
      return undefined;
  }
}

export function getEncounterLocation(
  document: ClinicalDocument,
): string | undefined {
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (document.data_record.raw as R4BundleEntry<R4Encounter>)?.resource;
      return resource?.location?.[0]?.location?.display;
    }
    case 'FHIR.DSTU2': {
      const resource = (document.data_record.raw as DSTU2BundleEntry<DSTU2Encounter>)?.resource;
      return resource?.location?.[0]?.location?.display;
    }
    default:
      return undefined;
  }
}

export function getDiagnosticReportPerformer(
  document: ClinicalDocument,
): string | undefined {
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (document.data_record.raw as R4BundleEntry<R4DiagnosticReport>)?.resource;
      return Array.isArray(resource?.performer)
        ? resource?.performer?.[0]?.display
        : undefined;
    }
    case 'FHIR.DSTU2': {
      const resource = (document.data_record.raw as DSTU2BundleEntry<DSTU2DiagnosticReport>)?.resource;
      return resource?.performer?.display;
    }
    default:
      return undefined;
  }
}

export function getObservationPerformer(
  document: ClinicalDocument,
): string | undefined {
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (document.data_record.raw as R4BundleEntry<R4Observation>)?.resource;
      return resource?.performer?.[0]?.display;
    }
    case 'FHIR.DSTU2': {
      const resource = (document.data_record.raw as DSTU2BundleEntry<DSTU2Observation>)?.resource;
      return resource?.performer?.[0]?.display;
    }
    default:
      return undefined;
  }
}

export function getProcedurePerformer(
  document: ClinicalDocument,
): string | undefined {
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (document.data_record.raw as R4BundleEntry<R4Procedure>)?.resource;
      return resource?.performer?.[0]?.actor?.display;
    }
    case 'FHIR.DSTU2': {
      const resource = (document.data_record.raw as DSTU2BundleEntry<DSTU2Procedure>)?.resource;
      return resource?.performer?.[0]?.actor?.display;
    }
    default:
      return undefined;
  }
}
