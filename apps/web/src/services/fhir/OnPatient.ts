/**
 * Functions related to authenticating against the OnPatient patient portal and syncing data
 */

import { Bundle, BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { ONPATIENT_CONSTANTS } from '@mere/fhir-oauth';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { DSTU2 } from '.';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { ResourceMapper, VendorSync, runSync, upsertEntries } from './sync';

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
  mapper: ResourceMapper<BundleEntry<T>, ConnectionDocument>,
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
    return runSync({
      Immunization: () =>
        syncFHIRResource(
          cd,
          db,
          'Immunization',
          DSTU2.mapImmunizationToClinicalDocument,
        ),
      Procedure: () =>
        syncFHIRResource(
          cd,
          db,
          'Procedure',
          DSTU2.mapProcedureToClinicalDocument,
        ),
      Condition: () =>
        syncFHIRResource(
          cd,
          db,
          'Condition',
          DSTU2.mapConditionToClinicalDocument,
        ),
      Observation: () =>
        syncFHIRResource(
          cd,
          db,
          'Observation',
          DSTU2.mapObservationToClinicalDocument,
        ),
      DiagnosticReport: () =>
        syncFHIRResource(
          cd,
          db,
          'DiagnosticReport',
          DSTU2.mapDiagnosticReportToClinicalDocument,
        ),
      MedicationStatement: () =>
        syncFHIRResource(
          cd,
          db,
          'MedicationStatement',
          DSTU2.mapMedicationStatementToClinicalDocument,
        ),
      AllergyIntolerance: () =>
        syncFHIRResource(
          cd,
          db,
          'AllergyIntolerance',
          DSTU2.mapAllergyIntoleranceToClinicalDocument,
        ),
      MedicationOrder: () =>
        syncFHIRResource(
          cd,
          db,
          'MedicationOrder',
          DSTU2.mapMedicationOrderToClinicalDocument,
        ),
      Patient: () =>
        syncFHIRResource(cd, db, 'Patient', DSTU2.mapPatientToClinicalDocument),
    });
  },
};
