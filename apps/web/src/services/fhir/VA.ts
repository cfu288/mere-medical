/* eslint-disable no-inner-declarations */
import {
  AllergyIntolerance,
  Bundle,
  BundleEntry,
  Condition,
  DiagnosticReport,
  FhirResource,
  Immunization,
  MedicationStatement,
  Observation,
  Patient,
  Procedure,
} from 'fhir/r2';
import { RxDocument, RxDatabase } from 'rxdb';
import {
  ConnectionDocument,
  CreateVAConnectionDocument,
  VAConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { Routes } from '../../Routes';
import { DSTU2 } from '.';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import { createConnection } from '../../repositories/ConnectionRepository';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import uuid4 from '../../shared/utils/UUIDUtils';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';
import {
  createVAClient,
  createSessionManager,
  VA_SANDBOX_TENANT,
  buildVAOAuthConfig,
  type VATokenSet,
} from '@mere/fhir-oauth';

export enum VALocalStorageKeys {
  VA_BASE_URL = 'vaBaseUrl',
  VA_AUTH_URL = 'vaAuthUrl',
  VA_TOKEN_URL = 'vaTokenUrl',
  VA_NAME = 'vaName',
  VA_ID = 'vaId',
}

const vaClient = createVAClient();

export async function getLoginUrl(
  config: AppConfig,
): Promise<string & Location> {
  const oauthConfig = buildVAOAuthConfig({
    clientId: config.VA_CLIENT_ID || '',
    publicUrl: config.PUBLIC_URL || '',
    redirectPath: Routes.VACallback,
  });

  const { url, session } = await vaClient.initiateAuth(oauthConfig);
  const sessionManager = createSessionManager('va');
  await sessionManager.save(session);

  return url as unknown as string & Location;
}

/**
 * Sometimes bundles may only return a subset of the total results
 * ex: {
 * "resourceType": "Bundle",
 * "type": "searchset",
 * "total": 7034,
 * "entry": [
 * ... only has subset of total results ...
 * ],
 * }
 * We want to iterate through all the pages using the ?page=<number>
 * query param until we've gotten all the results
 * This should iterate through pages 1 to N and call getFHIRResource for each page
 */
async function getAllFHIRResourcesWithPaging<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VAConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
): Promise<BundleEntry<T>[]> {
  let page = 0;
  let totalEntriesCount = 0;

  const allEntries: BundleEntry<T>[] = [];
  do {
    page++;
    const entries = await getFHIRResource<T>(
      baseUrl,
      connectionDocument,
      fhirResourceUrl,
      {
        ...params,
        page: `${page}`,
        _count: 1000,
      },
    );
    totalEntriesCount = entries.length;
    allEntries.push(...entries);
  } while (totalEntriesCount > 0);
  return allEntries;
}

async function getFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VAConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, any>,
): Promise<BundleEntry<T>[]> {
  const defaultUrl = `${baseUrl}${fhirResourceUrl}${
    !params ? '' : `?${new URLSearchParams(params)}`
  }`;

  const res = await fetch(defaultUrl, {
    headers: {
      Authorization: `Bearer ${connectionDocument.access_token}`,
      Accept: 'application/json+fhir',
    },
  })
    .then((res) => res.json())
    .then((res: Bundle) => res);

  if (res.entry) {
    return res.entry as BundleEntry<T>[];
  }
  return [];
}

/**
 * Sync a FHIR resource to the database
 * @param baseUrl Base url of the FHIR server
 * @param connectionDocument RxDocument of the connection document
 * @param db RxDatabase to save to
 * @param fhirResourceUrl URL path FHIR resource to sync. e.g. Patient, Procedure, etc. Exclude the leading slash.
 * @param mapper Function to map the FHIR resource to a ClinicalDocument
 * @param params Query parameters to pass to the FHIR request
 */
async function syncFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VAConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params?: Record<string, string>,
) {
  const resc = await getAllFHIRResourcesWithPaging<T>(
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
  );

  const cds = resc
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

/**
 * Sync all records from the FHIR server to the local database
 * @param baseUrl Base url of the FHIR server to sync from
 * @param connectionDocument
 * @param db
 * @returns A promise of void arrays
 */
export async function syncAllRecords(
  baseUrl: string,
  connectionDocument: VAConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
): Promise<PromiseSettledResult<void[]>[]> {
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
  const immMapper = (dr: BundleEntry<Immunization>) =>
    DSTU2.mapImmunizationToClinicalDocument(dr, connectionDocument);
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    DSTU2.mapConditionToClinicalDocument(dr, connectionDocument);
  const allergyIntoleranceMapper = (a: BundleEntry<AllergyIntolerance>) =>
    DSTU2.mapAllergyIntoleranceToClinicalDocument(a, connectionDocument);

  const patientId = (connectionDocument as VAConnectionDocument).patient;

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Procedure>(
      baseUrl,
      connectionDocument,
      db,
      'Procedure',
      procMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<Patient>(
      baseUrl,
      connectionDocument,
      db,
      `Patient/${patientId}`,
      patientMapper,
    ),
    syncFHIRResource<Observation>(
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<DiagnosticReport>(
      baseUrl,
      connectionDocument,
      db,
      'DiagnosticReport',
      drMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<MedicationStatement>(
      baseUrl,
      connectionDocument,
      db,
      'MedicationStatement',
      medStatementMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<Immunization>(
      baseUrl,
      connectionDocument,
      db,
      'Immunization',
      immMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<Condition>(
      baseUrl,
      connectionDocument,
      db,
      'Condition',
      conditionMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<AllergyIntolerance>(
      baseUrl,
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper,
      {
        patient: patientId,
      },
    ),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

export async function saveConnectionToDb({
  tokens,
  db,
  user,
}: {
  tokens: VATokenSet;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) {
  const doc = await getConnectionCardByUrl<VAConnectionDocument>(
    VA_SANDBOX_TENANT.fhirBaseUrl,
    db,
    user.id,
  );

  if (!tokens.accessToken || !tokens.idToken) {
    throw new Error(
      'Error completing authentication: no access token provided',
    );
  }

  if (doc) {
    await doc.update({
      $set: {
        access_token: tokens.accessToken,
        expires_at: tokens.expiresAt,
        scope: tokens.scope || '',
        last_sync_was_error: false,
      },
    });
    return;
  }

  const dbentry: CreateVAConnectionDocument = {
    id: uuid4(),
    user_id: user.id,
    source: 'va',
    location: VA_SANDBOX_TENANT.fhirBaseUrl,
    name: VA_SANDBOX_TENANT.name,
    access_token: tokens.accessToken,
    patient: tokens.patientId || '',
    scope: tokens.scope || '',
    id_token: tokens.idToken,
    refresh_token: tokens.refreshToken || '',
    expires_at: tokens.expiresAt,
    auth_uri: VA_SANDBOX_TENANT.authUrl,
    token_uri: VA_SANDBOX_TENANT.tokenUrl,
  };

  await createConnection(db, dbentry as ConnectionDocument);
}

/**
 * For a connection document, if the access token is expired, refresh it and save it to the db
 * @param config App configuration containing VA_CLIENT_ID
 * @param connectionDocument the connection document to refresh the access token for
 */
export async function refreshVAConnectionTokenIfNeeded(
  config: AppConfig,
  connectionDocument: RxDocument<ConnectionDocument>,
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = connectionDocument.get('expires_at');

  if (expiresAt > nowInSeconds) {
    return;
  }

  const refreshToken = connectionDocument.get('refresh_token');
  const tokenUri = connectionDocument.get('token_uri');
  const scope = connectionDocument.get('scope');

  if (!refreshToken) {
    throw new Error('No refresh token available - try logging in again');
  }

  const currentTokens: VATokenSet = {
    accessToken: connectionDocument.get('access_token'),
    refreshToken,
    expiresAt,
    scope,
    patientId: connectionDocument.get('patient'),
    raw: {},
  };

  const oauthConfig = buildVAOAuthConfig({
    clientId: config.VA_CLIENT_ID || '',
    publicUrl: config.PUBLIC_URL || '',
    redirectPath: Routes.VACallback,
    tenant: {
      ...VA_SANDBOX_TENANT,
      tokenUrl: tokenUri,
    },
  });

  const newTokens = await vaClient.refresh(currentTokens, oauthConfig);

  await connectionDocument.update({
    $set: {
      access_token: newTokens.accessToken,
      expires_at: newTokens.expiresAt,
      scope: newTokens.scope || scope,
      last_sync_was_error: false,
    },
  });
}
