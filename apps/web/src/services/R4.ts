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
  MedicationDispense,
  Patient,
  AllergyIntolerance,
  Practitioner,
  PractitionerRole,
  DocumentReference,
  CarePlan,
  CareTeam,
  FhirResource,
  Encounter,
  Goal,
  ServiceRequest,
  Coverage,
  Device,
  Media,
  Specimen,
  Provenance,
  RelatedPerson,
  Location,
  Organization,
} from 'fhir/r4';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';
import uuid4 from '../utils/UUIDUtils';
import { UserDocument } from '../models/user-document/UserDocument.type';
import { CreateClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';

function parseId<T = FhirResource>(bundleItem: BundleEntry<T>) {
  return bundleItem.fullUrl;
}

/**
 * Strips HTML/XHTML tags from a string to get plain text.
 * Used as a fallback when structured plain-text fields are not available.
 */
export function stripHtmlTags(html: string | undefined): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
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
        bundleItem.resource?.medicationReference?.display ||
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
      date: bundleItem.resource?.authoredOn || new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.medicationCodeableConcept?.text ||
        bundleItem.resource?.medicationReference?.display ||
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

export function mapMedicationDispenseToClinicalDocument(
  bundleItem: BundleEntry<MedicationDispense>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<MedicationDispense>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'medicationdispense',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.whenHandedOver ||
        bundleItem.resource?.whenPrepared ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.medicationCodeableConcept?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapServiceRequestToClinicalDocument(
  bundleItem: BundleEntry<ServiceRequest>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<ServiceRequest>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'servicerequest',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.authoredOn ||
        bundleItem.resource?.occurrenceDateTime ||
        bundleItem.resource?.occurrencePeriod?.start ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.code?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapGoalToClinicalDocument(
  bundleItem: BundleEntry<Goal>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Goal>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'goal',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.startDate ||
        bundleItem.resource?.statusDate ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.description?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapCareTeamToClinicalDocument(
  bundleItem: BundleEntry<CareTeam>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<CareTeam>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'careteam',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.period?.start || new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.name ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapCoverageToClinicalDocument(
  bundleItem: BundleEntry<Coverage>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Coverage>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'coverage',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.period?.start || new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.type?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapDeviceToClinicalDocument(
  bundleItem: BundleEntry<Device>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Device>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'device',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.manufactureDate ||
        bundleItem.resource?.expirationDate ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.deviceName?.[0]?.name ||
        bundleItem.resource?.type?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapMediaToClinicalDocument(
  bundleItem: BundleEntry<Media>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Media>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'media',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.createdDateTime ||
        bundleItem.resource?.createdPeriod?.start ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.type?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapSpecimenToClinicalDocument(
  bundleItem: BundleEntry<Specimen>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Specimen>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'specimen',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.receivedTime ||
        bundleItem.resource?.collection?.collectedDateTime ||
        bundleItem.resource?.collection?.collectedPeriod?.start ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.type?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapProvenanceToClinicalDocument(
  bundleItem: BundleEntry<Provenance>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Provenance>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'provenance',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.recorded ||
        bundleItem.resource?.occurredDateTime ||
        bundleItem.resource?.occurredPeriod?.start ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.reason?.[0]?.text ||
        bundleItem.resource?.activity?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapRelatedPersonToClinicalDocument(
  bundleItem: BundleEntry<RelatedPerson>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<RelatedPerson>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'relatedperson',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date:
        bundleItem.resource?.period?.start ||
        bundleItem.resource?.birthDate ||
        new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.name?.[0]?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapLocationToClinicalDocument(
  bundleItem: BundleEntry<Location>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Location>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'location',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.name ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapOrganizationToClinicalDocument(
  bundleItem: BundleEntry<Organization>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<Organization>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'organization',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.name ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}

export function mapPractitionerRoleToClinicalDocument(
  bundleItem: BundleEntry<PractitionerRole>,
  connectionDocument: ConnectionDocument,
) {
  const cd: CreateClinicalDocument<BundleEntry<PractitionerRole>> = {
    user_id: connectionDocument.user_id,
    connection_record_id: connectionDocument.id,
    data_record: {
      raw: bundleItem,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'practitionerrole',
      version_history: [],
    },
    metadata: {
      id: parseId(bundleItem),
      date: bundleItem.resource?.period?.start || new Date(0).toISOString(),
      display_name:
        bundleItem.resource?.code?.[0]?.text ||
        stripHtmlTags(bundleItem.resource?.text?.div) ||
        bundleItem.resource?.id ||
        '',
    },
  };
  return cd;
}
