/* eslint-disable @typescript-eslint/no-namespace */
import {
  BundleEntry,
  Procedure,
  Immunization,
  Condition,
  DiagnosticReport,
  Observation,
  MedicationStatement,
  MedicationRequest,
  Patient,
  AllergyIntolerance,
  Practitioner,
  DocumentReference,
  CarePlan,
  FhirResource,
  Encounter,
} from 'fhir/r4';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';
import uuid4 from '../utils/UUIDUtils';
import { UserDocument } from '../models/user-document/UserDocument.type';
import { CreateClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';

function parseId<T = FhirResource>(bundleItem: BundleEntry<T>) {
  const isArrayId =
    Array.isArray(bundleItem.fullUrl as string | string[]) &&
    bundleItem.fullUrl &&
    bundleItem.fullUrl?.length > 0;
  return isArrayId
    ? bundleItem.fullUrl?.[0].replace('/api/fhir/', '')
    : bundleItem.fullUrl;
}

/**
 * Strips HTML/XHTML tags from a string to get plain text.
 * Used as a fallback when structured plain-text fields are not available.
 */
function stripHtmlTags(html: string | undefined): string | undefined {
  if (!html) return undefined;
  // Remove all HTML tags and decode HTML entities
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/gi, ' ') // Replace non-breaking spaces
    .replace(/&amp;/gi, '&') // Replace ampersands
    .replace(/&lt;/gi, '<') // Replace less than
    .replace(/&gt;/gi, '>') // Replace greater than
    .replace(/&quot;/gi, '"') // Replace quotes
    .replace(/&#39;/gi, "'") // Replace apostrophes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

export function mapProcedureToClinicalDocument(
  bundleItem: BundleEntry<Procedure>,
  connectionDocument: Pick<ConnectionDocument, 'user_id' | 'id'>,
): CreateClinicalDocument<BundleEntry<Procedure>> {
  const cd: CreateClinicalDocument<BundleEntry<Procedure>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'procedure',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.performedDateTime || new Date(0).toISOString(),
      display_name: bundleItem.resource?.code?.text,
    },
  };
  return cd;
}

export function mapMedicationStatementToClinicalDocument(
  bundleItem: BundleEntry<MedicationStatement>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<MedicationStatement>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'medicationstatement',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.dateAsserted ||
        bundleItem.resource?.effectivePeriod?.start ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.medicationCodeableConcept?.text ||
        bundleItem.resource?.note?.[0]?.text,
    },
  };
  return cd;
}

export function mapMedicationRequestToClinicalDocument(
  bundleItem: BundleEntry<MedicationRequest>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<MedicationRequest>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'medicationrequest',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.authoredOn ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.medicationCodeableConcept?.text ||
        bundleItem.resource?.note?.[0]?.text,
    },
  };
  return cd;
}

export function mapObservationToClinicalDocument(
  bundleItem: BundleEntry<Observation>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Observation>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'observation',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.effectiveDateTime || new Date(0).toISOString(),
      display_name: (bundleItem.resource?.code?.text || '')
        ?.replace(/- final result/gi, '')
        .replace(/- final/gi, ''),
      loinc_coding:
        bundleItem.resource?.code?.coding
          ?.filter(
            (i) => i.system === 'http://loinc.org' && i.code !== undefined,
          )
          .map((i) => i.code as string) || [],
    },
  };
  return cd;
}

export function mapDiagnosticReportToClinicalDocument(
  bundleItem: BundleEntry<DiagnosticReport>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<DiagnosticReport>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'diagnosticreport',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.effectiveDateTime || new Date(0).toISOString(),
      display_name: (bundleItem.resource?.code?.text || '')
        ?.replace(/- final result/gi, '')
        .replace(/- final/gi, ''),
    },
  };
  return cd;
}

export function mapPatientToUserDocument(bundleItem: BundleEntry<Patient>) {
  const userDoc: UserDocument = {
    id: uuid4(),
    gender: bundleItem.resource?.gender,
    birthday: bundleItem.resource?.birthDate,
    first_name: bundleItem.resource?.name?.[0]?.given?.[0],
    last_name: bundleItem.resource?.name?.[0]?.family,
  };
  return userDoc;
}

export function mapPatientToClinicalDocument(
  bundleItem: BundleEntry<Patient>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Patient>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'patient',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: new Date(0).toISOString(),
    },
  };
  return cd;
}

export function mapImmunizationToClinicalDocument(
  bundleItem: BundleEntry<Immunization>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Immunization>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'immunization',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.occurrenceDateTime || new Date(0).toISOString(),
      display_name: bundleItem.resource?.vaccineCode?.text,
    },
  };
  return cd;
}

export function mapConditionToClinicalDocument(
  bundleItem: BundleEntry<Condition>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Condition>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'condition',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.recordedDate || new Date(0).toISOString(),
      display_name: bundleItem.resource?.code?.text,
    },
  };
  return cd;
}

export function mapEncounterToClinicalDocument(
  bundleItem: BundleEntry<Encounter>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Encounter>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'encounter',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.period?.start || new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.type?.[0]?.text ||
        bundleItem.resource?.class?.display ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapAllergyIntoleranceToClinicalDocument(
  bundleItem: BundleEntry<AllergyIntolerance>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<AllergyIntolerance>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'allergyintolerance',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.recordedDate || new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.code?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapPractitionerToClinicalDocument(
  bundleItem: BundleEntry<Practitioner>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Practitioner>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'practitioner',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.birthDate || new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.name?.[0]?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapDocumentReferenceToClinicalDocument(
  bundleItem: BundleEntry<DocumentReference>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<DocumentReference>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'documentreference',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.date || new Date(0).toISOString(),
      display_name: bundleItem.resource?.type?.text,
    },
  };
  return cd;
}

export function mapCarePlanToClinicalDocument(
  bundleItem: BundleEntry<CarePlan>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<CarePlan>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'careplan',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.period?.start || new Date(0).toISOString(),
      display_name: bundleItem.resource?.description,
    },
  };
  return cd;
}
