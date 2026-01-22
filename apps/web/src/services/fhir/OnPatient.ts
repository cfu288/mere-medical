/**
 * Functions related to authenticating against the OnPatient patient portal and syncing data
 */

import {
  Bundle,
  BundleEntry,
  Procedure,
  Immunization,
  Condition,
  Observation,
  DiagnosticReport,
  MedicationStatement,
  MedicationOrder,
  AllergyIntolerance,
  Patient,
  FhirResource,
} from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { ONPATIENT_CONSTANTS } from '@mere/fhir-oauth';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { DSTU2 } from '.';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../../models/clinical-document/ClinicalDocument.type';

export const OnPatientBaseUrl = ONPATIENT_CONSTANTS.BASE_URL;
export const OnPatientDSTU2Url = ONPATIENT_CONSTANTS.FHIR_URL;

async function getFHIRResource<T extends FhirResource>(
  connectionDocument: ConnectionDocument,
  fhirResourcePathUrl: string,
): Promise<BundleEntry<T>[]> {
  let allEntries: BundleEntry<T>[] = [];
  let nextUrl: string | undefined =
    `${OnPatientDSTU2Url}/${fhirResourcePathUrl}`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
      },
    });
    if (!response.ok) {
      console.error(await response.text());
      throw new Error('Error getting FHIR resource');
    }
    const bundle: Bundle = await response.json();

    if (bundle.entry) {
      allEntries = allEntries.concat(bundle.entry as BundleEntry<T>[]);
    }

    const nextLink = bundle.link?.find(
      (link: { relation?: string; url?: string }) => link.relation === 'next',
    );
    nextUrl = nextLink?.url;
  }

  return allEntries;
}

async function syncFHIRResource<T extends FhirResource>(
  connectionDocument: ConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
) {
  const fhirResources = await getFHIRResource<T>(
    connectionDocument,
    fhirResourceUrl,
  );
  const cds = fhirResources
    .filter(
      (i) =>
        i.resource?.resourceType.toLowerCase() ===
        fhirResourceUrl.toLowerCase(),
    )
    .map(mapper);
  const cdsmap = await db.clinical_documents.bulkUpsert(
    cds as unknown as ClinicalDocument[],
  );
  return cdsmap;
}

export async function syncAllRecords(
  connectionDocument: ConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
): Promise<PromiseSettledResult<void[]>[]> {
  const immMapper = (dr: BundleEntry<Immunization>) =>
    DSTU2.mapImmunizationToClinicalDocument(dr, connectionDocument);
  const procMapper = (proc: BundleEntry<Procedure>) =>
    DSTU2.mapProcedureToClinicalDocument(proc, connectionDocument);
  const patientMapper = (pt: BundleEntry<Patient>) =>
    DSTU2.mapPatientToClinicalDocument(pt, connectionDocument);
  const obsMapper = (imm: BundleEntry<Observation>) =>
    DSTU2.mapObservationToClinicalDocument(imm, connectionDocument);
  const drMapper = (dr: BundleEntry<DiagnosticReport>) =>
    DSTU2.mapDiagnosticReportToClinicalDocument(dr, connectionDocument);
  const medStatementMapper = (dr: BundleEntry<MedicationStatement>) =>
    DSTU2.mapMedicationStatementToClinicalDocument(dr, connectionDocument);
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    DSTU2.mapConditionToClinicalDocument(dr, connectionDocument);
  const allergyMapper = (dr: BundleEntry<AllergyIntolerance>) =>
    DSTU2.mapAllergyIntoleranceToClinicalDocument(dr, connectionDocument);
  const medOrderMapper = (dr: BundleEntry<MedicationOrder>) =>
    DSTU2.mapMedicationOrderToClinicalDocument(dr, connectionDocument);
  const syncJob = await Promise.allSettled([
    syncFHIRResource<Immunization>(
      connectionDocument,
      db,
      'Immunization',
      immMapper,
    ),
    syncFHIRResource<Procedure>(
      connectionDocument,
      db,
      'Procedure',
      procMapper,
    ),
    syncFHIRResource<Condition>(
      connectionDocument,
      db,
      'Condition',
      conditionMapper,
    ),
    syncFHIRResource<Observation>(
      connectionDocument,
      db,
      'Observation',
      obsMapper,
    ),
    syncFHIRResource<DiagnosticReport>(
      connectionDocument,
      db,
      'DiagnosticReport',
      drMapper,
    ),
    syncFHIRResource<MedicationStatement>(
      connectionDocument,
      db,
      'MedicationStatement',
      medStatementMapper,
    ),
    syncFHIRResource<AllergyIntolerance>(
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyMapper,
    ),
    syncFHIRResource<MedicationOrder>(
      connectionDocument,
      db,
      'MedicationOrder',
      medOrderMapper,
    ),
    syncFHIRResource<Patient>(connectionDocument, db, 'Patient', patientMapper),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}
