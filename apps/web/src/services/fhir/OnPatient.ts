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
import { CreateClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { runSync, upsertEntries, VendorSync } from './sync';

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
  mapper: (
    entry: BundleEntry<T>,
    connection: ConnectionDocument,
  ) => CreateClinicalDocument<BundleEntry<T>>,
) {
  const fhirResources = await getFHIRResource<T>(
    connectionDocument,
    fhirResourceUrl,
  );

  return upsertEntries(
    db,
    fhirResources,
    fhirResourceUrl,
    mapper,
    connectionDocument,
  );
}

export const sync: VendorSync = {
  refreshToken: null,
  syncAllRecords: ({ connection, db }) => {
    const cd = connection.toMutableJSON() as ConnectionDocument;
    const get =
      <T extends FhirResource>(
        path: string,
        mapper: (
          entry: BundleEntry<T>,
          connection: ConnectionDocument,
        ) => CreateClinicalDocument<BundleEntry<T>>,
      ) =>
      () =>
        syncFHIRResource<T>(cd, db, path, mapper);

    return runSync({
      Immunization: get<Immunization>(
        'Immunization',
        DSTU2.mapImmunizationToClinicalDocument,
      ),
      Procedure: get<Procedure>(
        'Procedure',
        DSTU2.mapProcedureToClinicalDocument,
      ),
      Condition: get<Condition>(
        'Condition',
        DSTU2.mapConditionToClinicalDocument,
      ),
      Observation: get<Observation>(
        'Observation',
        DSTU2.mapObservationToClinicalDocument,
      ),
      DiagnosticReport: get<DiagnosticReport>(
        'DiagnosticReport',
        DSTU2.mapDiagnosticReportToClinicalDocument,
      ),
      MedicationStatement: get<MedicationStatement>(
        'MedicationStatement',
        DSTU2.mapMedicationStatementToClinicalDocument,
      ),
      AllergyIntolerance: get<AllergyIntolerance>(
        'AllergyIntolerance',
        DSTU2.mapAllergyIntoleranceToClinicalDocument,
      ),
      MedicationOrder: get<MedicationOrder>(
        'MedicationOrder',
        DSTU2.mapMedicationOrderToClinicalDocument,
      ),
      Patient: get<Patient>('Patient', DSTU2.mapPatientToClinicalDocument),
    });
  },
};
