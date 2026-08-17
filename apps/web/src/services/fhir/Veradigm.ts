/**
 * Partner Training Environment CP00101 SANDBOX (R4) Veradigm Connect
 * Patient Access
 * Property                   Value
 * FHIR Base Url              https://fhir.fhirpoint.open.allscripts.com/fhirroute/open/CP00101/
 * OAuth Authorization URL    https://open.allscripts.com/fhirroute/patientauthv2/afdc1f7b-b362-4777-8ab3-83472abd0b8a/connect/authorize
 * OAuth Token URL            https://open.allscripts.com/fhirroute/patientauthv2/afdc1f7b-b362-4777-8ab3-83472abd0b8a/connect/token
 * OAuth Scope                SMART v1 (.read) or v2 (.rs), mixing unsupported
 * Test credentials           not published; request via https://developer.veradigm.com/Fhir/FHIR_Sandboxes
 */

import * as R4 from './R4';
import {
  CreateVeradigmConnectionDocument,
  VeradigmConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import {
  FhirResource,
  BundleEntry,
  Bundle,
  Procedure,
  Patient,
  Observation,
  DiagnosticReport,
  MedicationRequest,
  MedicationStatement,
  Immunization,
  Condition,
  AllergyIntolerance,
  DocumentReference,
} from 'fhir/r4';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import {
  createVeradigmClient,
  buildVeradigmOAuthConfig,
  extractVeradigmPatientId,
  type VeradigmTokenSet,
} from '@mere/fhir-oauth';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';
import {
  createConnection,
  updateConnection,
  updateConnectionToken,
} from '../../repositories/ConnectionRepository';
import uuid4 from '../../shared/utils/UUIDUtils';
import { RxDocument } from 'rxdb';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import { Routes } from '../../Routes';

export {
  createVeradigmClient,
  buildVeradigmOAuthConfig,
  VERADIGM_DEFAULT_SCOPES,
  type VeradigmClient,
  type VeradigmTokenSet,
  type VeradigmOAuthConfigOptions,
} from '@mere/fhir-oauth';

export enum VeradigmLocalStorageKeys {
  VERADIGM_BASE_URL = 'veradigmBaseUrl',
  VERADIGM_AUTH_URL = 'veradigmAuthUrl',
  VERADIGM_TOKEN_URL = 'veradigmTokenUrl',
  VERADIGM_NAME = 'veradigmName',
  VERADIGM_ID = 'veradigmId',
}

export async function saveConnectionToDb({
  tokens,
  veradigmBaseUrl,
  veradigmId,
  db,
  user,
  name,
  auth_uri,
  token_uri,
}: {
  tokens: VeradigmTokenSet;
  veradigmBaseUrl: string;
  veradigmId: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  name: string;
  auth_uri: string;
  token_uri: string;
}) {
  const doc = await getConnectionCardByUrl<VeradigmConnectionDocument>(
    veradigmBaseUrl,
    db,
    user.id,
  );
  return new Promise((resolve, reject) => {
    if (tokens.accessToken && user.id) {
      if (doc) {
        updateConnection<VeradigmConnectionDocument>(db, user.id, doc.id, {
          access_token: tokens.accessToken,
          expires_at: tokens.expiresAt,
          id_token: tokens.idToken,
          patient: tokens.patientId,
          last_sync_was_error: false,
          ...(tokens.refreshToken && { refresh_token: tokens.refreshToken }),
        })
          .then(() => {
            resolve(true);
          })
          .catch((e) => {
            console.error(e);
            reject(new Error('Error updating connection'));
          });
      } else {
        const dbentry: CreateVeradigmConnectionDocument = {
          id: uuid4(),
          user_id: user.id,
          source: 'veradigm',
          location: veradigmBaseUrl,
          access_token: tokens.accessToken,
          expires_at: tokens.expiresAt,
          id_token: tokens.idToken,
          patient: tokens.patientId,
          name,
          ...(tokens.refreshToken && { refresh_token: tokens.refreshToken }),
          auth_uri,
          token_uri,
          tenant_id: veradigmId,
        };
        try {
          createConnection(db, dbentry)
            .then(() => {
              resolve(true);
            })
            .catch((e) => {
              console.error(e);
              reject(new Error('Error updating connection'));
            });
        } catch (e) {
          console.error(e);
          reject(new Error('Error updating connection'));
        }
      }
    } else {
      reject(
        new Error('Error completing authentication: no access token provided'),
      );
    }
  });
}

const veradigmClient = createVeradigmClient();

export async function refreshVeradigmConnectionTokenIfNeeded(
  config: AppConfig,
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  const currentTokens: VeradigmTokenSet = {
    accessToken: connectionDocument.get('access_token'),
    expiresAt: connectionDocument.get('expires_at'),
    idToken: connectionDocument.get('id_token'),
    refreshToken: connectionDocument.get('refresh_token'),
    patientId: connectionDocument.get('patient') ?? '',
    raw: {},
  };

  if (!veradigmClient.isExpired(currentTokens, 0)) {
    return;
  }

  if (!veradigmClient.canRefresh(currentTokens)) {
    throw new Error('No refresh token available - try logging in again');
  }

  if (!config.VERADIGM_CLIENT_ID || !config.PUBLIC_URL) {
    throw new Error('Veradigm OAuth configuration is incomplete');
  }

  try {
    const baseUrl = connectionDocument.get('location');
    const oauthConfig = buildVeradigmOAuthConfig({
      clientId: config.VERADIGM_CLIENT_ID,
      publicUrl: config.PUBLIC_URL,
      redirectPath: Routes.VeradigmCallback,
      tenant: {
        id: connectionDocument.get('tenant_id') ?? baseUrl,
        name: connectionDocument.get('name'),
        authUrl: connectionDocument.get('auth_uri'),
        tokenUrl: connectionDocument.get('token_uri'),
        fhirBaseUrl: baseUrl,
      },
    });

    const newTokens = await veradigmClient.refresh(currentTokens, oauthConfig);

    await updateConnectionToken(
      db,
      connectionDocument.get('user_id'),
      connectionDocument.get('id'),
      {
        access_token: newTokens.accessToken,
        expires_at: newTokens.expiresAt,
        id_token: newTokens.idToken,
        ...(newTokens.refreshToken && {
          refresh_token: newTokens.refreshToken,
        }),
      },
    );
  } catch (e) {
    console.error(e);
    throw new Error('Error refreshing token - try logging in again');
  }
}

async function getFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
): Promise<BundleEntry<T>[]> {
  const defaultUrl = params
    ? `${baseUrl}${fhirResourceUrl}?${new URLSearchParams(params)}`
    : `${baseUrl}${fhirResourceUrl}`;

  let allEntries: BundleEntry<T>[] = [];
  let nextUrl: string | undefined = defaultUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
        // Versionless endpoints default to DSTU2: developer.veradigm.com/Fhir/EndpointDirectory
        Accept: 'application/fhir+json; fhirVersion=4.0',
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
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params?: Record<string, string>,
) {
  const resc = await getFHIRResource<T>(
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

export async function syncAllRecords(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
): Promise<PromiseSettledResult<void[]>[]> {
  const procMapper = (proc: BundleEntry<Procedure>) =>
    R4.mapProcedureToClinicalDocument(proc, connectionDocument);
  const patientMapper = (pt: BundleEntry<Patient>) =>
    R4.mapPatientToClinicalDocument(pt, connectionDocument);
  const obsMapper = (imm: BundleEntry<Observation>) =>
    R4.mapObservationToClinicalDocument(imm, connectionDocument);
  const drMapper = (dr: BundleEntry<DiagnosticReport>) =>
    R4.mapDiagnosticReportToClinicalDocument(dr, connectionDocument);
  const medRequestMapper = (mr: BundleEntry<MedicationRequest>) =>
    R4.mapMedicationRequestToClinicalDocument(mr, connectionDocument);
  const medStatementMapper = (ms: BundleEntry<MedicationStatement>) =>
    R4.mapMedicationStatementToClinicalDocument(ms, connectionDocument);
  const immMapper = (dr: BundleEntry<Immunization>) =>
    R4.mapImmunizationToClinicalDocument(dr, connectionDocument);
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    R4.mapConditionToClinicalDocument(dr, connectionDocument);
  const allergyIntoleranceMapper = (a: BundleEntry<AllergyIntolerance>) =>
    R4.mapAllergyIntoleranceToClinicalDocument(a, connectionDocument);

  const patientId =
    connectionDocument.patient ??
    extractVeradigmPatientId(connectionDocument.access_token);

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
      'Patient',
      patientMapper,
      {
        _id: patientId,
      },
    ),
    syncFHIRResource<Observation>(
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper,
      {
        patient: patientId,
        category: 'laboratory',
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
    syncFHIRResource<MedicationRequest>(
      baseUrl,
      connectionDocument,
      db,
      'MedicationRequest',
      medRequestMapper,
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
    syncDocumentReferences(baseUrl, connectionDocument, db, {
      patient: patientId,
    }),
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

async function syncDocumentReferences(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
) {
  const documentReferenceMapper = (dr: BundleEntry<DocumentReference>) =>
    R4.mapDocumentReferenceToClinicalDocument(dr, connectionDocument);
  // Sync document references and return them
  await syncFHIRResource<DocumentReference>(
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    documentReferenceMapper,
    params,
  );

  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: connectionDocument.user_id,
        'data_record.resource_type': {
          $eq: 'documentreference',
        },
        connection_record_id: `${connectionDocument.id}`,
      },
    })
    .exec();

  // format all the document references
  const docRefItems = docs.map(
    (doc) =>
      doc.toMutableJSON() as unknown as ClinicalDocument<
        BundleEntry<DocumentReference>
      >,
  );
  // for each docref, get attachments and sync them
  const cdsmap = docRefItems.map(async (docRefItem) => {
    const attachmentUrls = (
      docRefItem.data_record.raw as BundleEntry<DocumentReference>
    ).resource?.content.map((a) => a.attachment.url);
    if (attachmentUrls) {
      for (const attachmentUrl of attachmentUrls) {
        if (attachmentUrl) {
          const exists = await db.clinical_documents
            .find({
              selector: {
                $and: [
                  { user_id: connectionDocument.user_id },
                  { 'metadata.id': `${attachmentUrl}` },
                  {
                    connection_record_id: `${docRefItem.connection_record_id}`,
                  },
                ],
              },
            })
            .exec();
          if (exists.length === 0) {
            console.log('Syncing attachment: ' + attachmentUrl);
            // attachment does not exist, sync it
            const { contentType, raw } = await fetchAttachmentData(
              attachmentUrl,
              connectionDocument,
            );
            if (raw && contentType) {
              const cd: CreateClinicalDocument<string | Blob> = {
                user_id: connectionDocument.user_id,
                connection_record_id: connectionDocument.id,
                data_record: {
                  raw: raw,
                  format: 'FHIR.R4',
                  content_type: contentType,
                  resource_type: 'documentreference_attachment',
                  version_history: [],
                },
                metadata: {
                  id: attachmentUrl,
                  date:
                    docRefItem.data_record.raw.resource?.date ||
                    docRefItem.data_record.raw.resource?.context?.period?.start,
                  display_name:
                    docRefItem.data_record.raw.resource?.type?.text ||
                    docRefItem.metadata?.display_name,
                },
              };

              await db.clinical_documents.insert(
                cd as unknown as ClinicalDocument,
              );
            }
          } else {
            console.log('Attachment already synced: ' + attachmentUrl);
          }
        }
      }
    }
  });
  return await Promise.all(cdsmap);
}

async function fetchAttachmentData(
  url: string,
  cd: VeradigmConnectionDocument,
): Promise<{ contentType: string | null; raw: string | Blob | undefined }> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cd.access_token}`,
      },
    });
    if (!res.ok) {
      throw new Error(
        'Could not get document as the user is unauthorized. Try logging in again.',
      );
    }
    const contentType = res.headers.get('Content-Type');
    let raw = undefined;
    if (contentType === 'application/xml') {
      raw = await res.text();
    }

    if (contentType === 'application/pdf') {
      raw = await res.blob();
    }

    return { contentType, raw };
  } catch (e) {
    throw new Error(
      'Could not get document as the user is unauthorized. Try logging in again.',
    );
  }
}
