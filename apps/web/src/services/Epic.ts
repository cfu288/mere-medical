/* eslint-disable no-inner-declarations */
/* eslint-disable @typescript-eslint/no-namespace */
import {
  AllergyIntolerance,
  Bundle,
  BundleEntry,
  CarePlan,
  Condition,
  DiagnosticReport,
  DocumentReference,
  FhirResource,
  Immunization,
  MedicationStatement,
  Observation,
  Patient,
  Procedure,
} from 'fhir/r2';
import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/RxDbProvider';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { ClinicalDocumentType } from '../models/ClinicalDocumentCollection';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { Routes } from '../Routes';
import { DSTU2 } from './DSTU2';
import Config from '../environments/config.json';
import { useState, useEffect } from 'react';

export namespace Epic {
  // export const EpicBaseUrl = 'https://mepic.hmhn.org/fhir';
  // export const EpicBaseUrl = 'https://fhir.epic.com/interconnect-fhir-oauth';
  // export const EpicDSTU2Url = `${EpicBaseUrl}/api/FHIR/DSTU2`;

  export function getDSTU2Url(baseUrl: string) {
    return `${baseUrl}/api/FHIR/DSTU2`;
  }

  export function getLoginUrl(baseUrl: string): string & Location {
    const params = {
      client_id: `${Config.EPIC_CLIENT_ID}`,
      scope: 'Patient.read Patient.search',
      redirect_uri: `${Config.PUBLIC_URL}${Routes.EpicCallback}`,
      aud: getDSTU2Url(baseUrl),
      response_type: 'code',
    };

    return `${baseUrl}/oauth2/authorize?${new URLSearchParams(
      params
    )}` as string & Location;
  }

  export enum LocalStorageKeys {
    EPIC_URL = 'epicUrl',
    EPIC_NAME = 'epicName',
  }

  async function getFHIRResource<T extends FhirResource>(
    baseUrl: string,
    connectionDocument: RxDocument<ConnectionDocument>,
    fhirResourceUrl: string,
    params?: any
  ): Promise<BundleEntry<T>[]> {
    const res = await fetch(
      `${getDSTU2Url(baseUrl)}/${fhirResourceUrl}?_format=${encodeURIComponent(
        `application/fhir+json`
      )}&${new URLSearchParams(params)}`,
      {
        headers: {
          Authorization: `Bearer ${connectionDocument.get('access_token')}`,
        },
      }
    )
      .then((res) => res.json())
      .then((res: Bundle) => res);

    if (res.entry) {
      return res.entry as BundleEntry<T>[];
    }
    return [];
  }

  async function syncFHIRResource<T extends FhirResource>(
    baseUrl: string,
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>,
    fhirResourceUrl: string,
    mapper: (proc: BundleEntry<T>) => ClinicalDocument<T>,
    params: Record<string, string>
  ) {
    const resc = await getFHIRResource<T>(
      baseUrl,
      connectionDocument,
      fhirResourceUrl,
      params
    );
    const cds = resc
      .filter(
        (i) =>
          i.resource?.resourceType.toLowerCase() ===
          fhirResourceUrl.toLowerCase()
      )
      .map(mapper);
    const cdsmap = cds.map(async (cd) => {
      const exists = await db.clinical_documents
        .find({
          selector: {
            $and: [
              { 'metadata.id': `${cd.metadata?.id}` },
              { source_record: `${cd.source_record}` },
            ],
          },
        })
        .exec();
      if (exists.length === 0) {
        await db.clinical_documents.insert(
          cd as unknown as ClinicalDocumentType
        );
      }
    });
    return await Promise.all(cdsmap);
  }

  export async function syncAllRecords(
    baseUrl: string,
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ): Promise<any[][]> {
    const newCd = connectionDocument.toMutableJSON();
    newCd.last_refreshed = new Date().toISOString();
    const procMapper = (proc: BundleEntry<Procedure>) =>
      DSTU2.mapProcedureToClinicalDocument(proc, connectionDocument.toJSON());
    const patientMapper = (pt: BundleEntry<Patient>) =>
      DSTU2.mapPatientToClinicalDocument(pt, connectionDocument);
    const obsMapper = (imm: BundleEntry<Observation>) =>
      DSTU2.mapObservationToClinicalDocument(imm, connectionDocument.toJSON());
    const drMapper = (dr: BundleEntry<DiagnosticReport>) =>
      DSTU2.mapDiagnosticReportToClinicalDocument(
        dr,
        connectionDocument.toJSON()
      );
    const medStatementMapper = (dr: BundleEntry<MedicationStatement>) =>
      DSTU2.mapMedicationStatementToClinicalDocument(
        dr,
        connectionDocument.toJSON()
      );
    const immMapper = (dr: BundleEntry<Immunization>) =>
      DSTU2.mapImmunizationToClinicalDocument(dr, connectionDocument.toJSON());
    const conditionMapper = (dr: BundleEntry<Condition>) =>
      DSTU2.mapConditionToClinicalDocument(dr, connectionDocument.toJSON());
    const allergyIntoleranceMapper = (a: BundleEntry<AllergyIntolerance>) =>
      DSTU2.mapAllergyIntoleranceToClinicalDocument(
        a,
        connectionDocument.toJSON()
      );
    const documentReferenceMapper = (dr: BundleEntry<DocumentReference>) =>
      DSTU2.mapDocumentReferenceToClinicalDocument(
        dr,
        connectionDocument.toJSON()
      );
    const carePlanMapper = (dr: BundleEntry<CarePlan>) =>
      DSTU2.mapCarePlanToClinicalDocument(dr, connectionDocument.toJSON());

    const syncJob = await Promise.all([
      syncFHIRResource<Procedure>(
        baseUrl,
        connectionDocument,
        db,
        'Procedure',
        procMapper,
        {
          patient: connectionDocument.get('patient'),
        }
      ),
      syncFHIRResource<Patient>(
        baseUrl,
        connectionDocument,
        db,
        'Patient',
        patientMapper,
        {
          _id: connectionDocument.get('patient'),
        }
      ),
      syncFHIRResource<Observation>(
        baseUrl,
        connectionDocument,
        db,
        'Observation',
        obsMapper,
        {
          patient: connectionDocument.get('patient'),
          category: 'laboratory',
        }
      ),
      syncFHIRResource<DiagnosticReport>(
        baseUrl,
        connectionDocument,
        db,
        'DiagnosticReport',
        drMapper,
        {
          patient: connectionDocument.get('patient'),
        }
      ),
      syncFHIRResource<MedicationStatement>(
        baseUrl,
        connectionDocument,
        db,
        'MedicationStatement',
        medStatementMapper,
        {
          patient: connectionDocument.get('patient'),
        }
      ),
      syncFHIRResource<Immunization>(
        baseUrl,
        connectionDocument,
        db,
        'Immunization',
        immMapper,
        {
          patient: connectionDocument.get('patient'),
        }
      ),
      syncFHIRResource<Condition>(
        baseUrl,
        connectionDocument,
        db,
        'Condition',
        conditionMapper,
        {
          patient: connectionDocument.get('patient'),
        }
      ),
      syncFHIRResource<DocumentReference>(
        baseUrl,
        connectionDocument,
        db,
        'DocumentReference',
        documentReferenceMapper,
        {
          patient: connectionDocument.get('patient'),
        }
      ),
      syncFHIRResource<CarePlan>(
        baseUrl,
        connectionDocument,
        db,
        'CarePlan',
        carePlanMapper,
        {
          patient: connectionDocument.get('patient'),
        }
      ),
      syncFHIRResource<AllergyIntolerance>(
        baseUrl,
        connectionDocument,
        db,
        'AllergyIntolerance',
        allergyIntoleranceMapper,
        {
          patient: connectionDocument.get('patient'),
        }
      ),
      db.connection_documents.upsert(newCd).then(() => []),
    ]);
    return syncJob;
  }
}
