import { BundleEntry as DSTU2BundleEntry } from 'fhir/r2';
import {
  BundleEntry as R4BundleEntry,
  Encounter as R4Encounter,
  DiagnosticReport as R4DiagnosticReport,
  Observation as R4Observation,
  Procedure as R4Procedure,
  AllergyIntolerance as R4AllergyIntolerance,
  MedicationRequest as R4MedicationRequest,
} from 'fhir/r4';
import {
  Encounter as DSTU2Encounter,
  DiagnosticReport as DSTU2DiagnosticReport,
  Observation as DSTU2Observation,
  Procedure as DSTU2Procedure,
  AllergyIntolerance as DSTU2AllergyIntolerance,
  MedicationOrder as DSTU2MedicationOrder,
} from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';

export function getEncounterClass(
  document: ClinicalDocument,
): string | undefined {
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (document.data_record.raw as R4BundleEntry<R4Encounter>)
        ?.resource;
      return resource?.class?.code;
    }
    case 'FHIR.DSTU2': {
      const resource = (
        document.data_record.raw as DSTU2BundleEntry<DSTU2Encounter>
      )?.resource;
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
      const resource = (document.data_record.raw as R4BundleEntry<R4Encounter>)
        ?.resource;
      return resource?.location?.[0]?.location?.display;
    }
    case 'FHIR.DSTU2': {
      const resource = (
        document.data_record.raw as DSTU2BundleEntry<DSTU2Encounter>
      )?.resource;
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
      const resource = (
        document.data_record.raw as R4BundleEntry<R4DiagnosticReport>
      )?.resource;
      return Array.isArray(resource?.performer)
        ? resource?.performer?.[0]?.display
        : undefined;
    }
    case 'FHIR.DSTU2': {
      const resource = (
        document.data_record.raw as DSTU2BundleEntry<DSTU2DiagnosticReport>
      )?.resource;
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
      const resource = (
        document.data_record.raw as R4BundleEntry<R4Observation>
      )?.resource;
      return resource?.performer?.[0]?.display;
    }
    case 'FHIR.DSTU2': {
      const resource = (
        document.data_record.raw as DSTU2BundleEntry<DSTU2Observation>
      )?.resource;
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
      const resource = (document.data_record.raw as R4BundleEntry<R4Procedure>)
        ?.resource;
      return resource?.performer?.[0]?.actor?.display;
    }
    case 'FHIR.DSTU2': {
      const resource = (
        document.data_record.raw as DSTU2BundleEntry<DSTU2Procedure>
      )?.resource;
      return resource?.performer?.[0]?.actor?.display;
    }
    default:
      return undefined;
  }
}

export function getEncounterPatient(
  document: ClinicalDocument,
): string | undefined {
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (document.data_record.raw as R4BundleEntry<R4Encounter>)
        ?.resource;
      return resource?.subject?.display;
    }
    case 'FHIR.DSTU2': {
      const resource = (
        document.data_record.raw as DSTU2BundleEntry<DSTU2Encounter>
      )?.resource;
      return resource?.patient?.display;
    }
    default:
      return undefined;
  }
}

export function getEncounterIndication(
  document: ClinicalDocument,
): Array<{ display?: string; reference?: string }> {
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (document.data_record.raw as R4BundleEntry<R4Encounter>)
        ?.resource;
      return resource?.reasonReference || [];
    }
    case 'FHIR.DSTU2': {
      const resource = (
        document.data_record.raw as DSTU2BundleEntry<DSTU2Encounter>
      )?.resource;
      return resource?.indication || [];
    }
    default:
      return [];
  }
}

export function getAllergyIntoleranceDisplayName(
  document: ClinicalDocument,
): string | undefined {
  if (document.metadata?.display_name) {
    return document.metadata.display_name;
  }
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (
        document.data_record.raw as R4BundleEntry<R4AllergyIntolerance>
      )?.resource;
      return (
        resource?.code?.text ||
        resource?.code?.coding?.[0]?.display ||
        resource?.text?.div
      );
    }
    case 'FHIR.DSTU2': {
      const resource = (
        document.data_record.raw as DSTU2BundleEntry<DSTU2AllergyIntolerance>
      )?.resource;
      return (
        resource?.substance?.text ||
        resource?.substance?.coding?.[0]?.display ||
        resource?.text?.div
      );
    }
    default:
      return undefined;
  }
}

export function getMedicationOrderDisplayName(
  document: ClinicalDocument,
): string | undefined {
  if (document.metadata?.display_name) {
    return document.metadata.display_name;
  }
  switch (document.data_record.format) {
    case 'FHIR.R4': {
      const resource = (
        document.data_record.raw as R4BundleEntry<R4MedicationRequest>
      )?.resource;
      return (
        resource?.medicationCodeableConcept?.text ||
        resource?.medicationCodeableConcept?.coding?.[0]?.display ||
        resource?.text?.div
      );
    }
    case 'FHIR.DSTU2': {
      const resource = (
        document.data_record.raw as DSTU2BundleEntry<DSTU2MedicationOrder>
      )?.resource;
      return (
        resource?.medicationCodeableConcept?.text ||
        resource?.medicationCodeableConcept?.coding?.[0]?.display ||
        resource?.text?.div
      );
    }
    default:
      return undefined;
  }
}
