/**
 * Functions related to authenticating against the OnPatient patient portal and syncing data
 */

import { Bundle, BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { ONPATIENT_CONSTANTS } from '@mere/fhir-oauth';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { DSTU2 } from '.';
import {
  ConnectionDocument,
  OnPatientConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { ResourceMapper, VendorSync, mapSearchedResources } from './sync';
import { bulkUpsertDocuments } from '../../repositories/ClinicalDocumentRepository';

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

  return bulkUpsertDocuments(
    db,
    mapSearchedResources(
      fhirResources,
      fhirResourceUrl,
      mapper,
      connectionDocument,
    ),
  );
}

export const sync: VendorSync<OnPatientConnectionDocument> = {
  refreshToken: null,
  syncAllRecords: ({ document: cd, db }) => {
    return Promise.allSettled([
      syncFHIRResource(
        cd,
        db,
        'Immunization',
        DSTU2.mapImmunizationToClinicalDocument,
      ),
      syncFHIRResource(
        cd,
        db,
        'Procedure',
        DSTU2.mapProcedureToClinicalDocument,
      ),
      syncFHIRResource(
        cd,
        db,
        'Condition',
        DSTU2.mapConditionToClinicalDocument,
      ),
      syncFHIRResource(
        cd,
        db,
        'Observation',
        DSTU2.mapObservationToClinicalDocument,
      ),
      syncFHIRResource(
        cd,
        db,
        'DiagnosticReport',
        DSTU2.mapDiagnosticReportToClinicalDocument,
      ),
      syncFHIRResource(
        cd,
        db,
        'MedicationStatement',
        DSTU2.mapMedicationStatementToClinicalDocument,
      ),
      syncFHIRResource(
        cd,
        db,
        'AllergyIntolerance',
        DSTU2.mapAllergyIntoleranceToClinicalDocument,
      ),
      syncFHIRResource(
        cd,
        db,
        'MedicationOrder',
        DSTU2.mapMedicationOrderToClinicalDocument,
      ),
      syncFHIRResource(cd, db, 'Patient', DSTU2.mapPatientToClinicalDocument),
    ]);
  },
};
