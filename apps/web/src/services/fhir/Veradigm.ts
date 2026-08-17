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
import { CreateClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
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
import { ResourceMapper, VendorSync, mapSearchedResources } from './sync';
import { RxDocument } from 'rxdb';
import { AnyConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
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
import {
  bulkUpsertDocuments,
  createDocument,
  documentExistsByMetadataId,
  findDocumentsByResourceType,
} from '../../repositories/ClinicalDocumentRepository';

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
  // TODO: look up by veradigmId, which this function already stores as tenant_id
  const doc = await getConnectionCardByUrl(
    'veradigm',
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
  connectionDocument: RxDocument<AnyConnectionDocument>,
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
  mapper: ResourceMapper<BundleEntry<T>, VeradigmConnectionDocument>,
  params?: Record<string, string>,
) {
  const resc = await getFHIRResource<T>(
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
  );

  return bulkUpsertDocuments(
    db,
    mapSearchedResources(resc, fhirResourceUrl, mapper, connectionDocument),
  );
}

export const sync: VendorSync<VeradigmConnectionDocument> = {
  refreshToken: ({ config, connection, db }) =>
    refreshVeradigmConnectionTokenIfNeeded(config, connection, db),
  syncAllRecords: ({ fhirBaseUrl: baseUrl, document: cd, db }) => {
    const patient = cd.patient ?? extractVeradigmPatientId(cd.access_token);
    return Promise.allSettled([
      syncFHIRResource<Procedure>(
        baseUrl,
        cd,
        db,
        'Procedure',
        R4.mapProcedureToClinicalDocument,
        { patient },
      ),
      syncFHIRResource<Patient>(
        baseUrl,
        cd,
        db,
        'Patient',
        R4.mapPatientToClinicalDocument,
        { _id: patient },
      ),
      syncFHIRResource<Observation>(
        baseUrl,
        cd,
        db,
        'Observation',
        R4.mapObservationToClinicalDocument,
        { patient, category: 'laboratory' },
      ),
      syncFHIRResource<DiagnosticReport>(
        baseUrl,
        cd,
        db,
        'DiagnosticReport',
        R4.mapDiagnosticReportToClinicalDocument,
        { patient },
      ),
      syncFHIRResource<MedicationRequest>(
        baseUrl,
        cd,
        db,
        'MedicationRequest',
        R4.mapMedicationRequestToClinicalDocument,
        { patient },
      ),
      syncFHIRResource<MedicationStatement>(
        baseUrl,
        cd,
        db,
        'MedicationStatement',
        R4.mapMedicationStatementToClinicalDocument,
        { patient },
      ),
      syncFHIRResource<Immunization>(
        baseUrl,
        cd,
        db,
        'Immunization',
        R4.mapImmunizationToClinicalDocument,
        { patient },
      ),
      syncFHIRResource<Condition>(
        baseUrl,
        cd,
        db,
        'Condition',
        R4.mapConditionToClinicalDocument,
        { patient },
      ),
      syncDocumentReferences(baseUrl, cd, db, { patient }),
      syncFHIRResource<AllergyIntolerance>(
        baseUrl,
        cd,
        db,
        'AllergyIntolerance',
        R4.mapAllergyIntoleranceToClinicalDocument,
        { patient },
      ),
    ]);
  },
};

async function syncDocumentReferences(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
) {
  // Sync document references and return them
  await syncFHIRResource<DocumentReference>(
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    R4.mapDocumentReferenceToClinicalDocument,
    params,
  );

  // format all the document references
  const docRefItems = await findDocumentsByResourceType<
    BundleEntry<DocumentReference>
  >(db, connectionDocument.user_id, connectionDocument.id, 'documentreference');
  // for each docref, get attachments and sync them
  const cdsmap = docRefItems.map(async (docRefItem) => {
    const attachments = (
      docRefItem.data_record.raw as BundleEntry<DocumentReference>
    ).resource?.content.map((a) => a.attachment);
    if (attachments) {
      for (const attachment of attachments) {
        const attachmentUrl = attachment?.url;
        if (attachmentUrl) {
          const exists = await documentExistsByMetadataId(
            db,
            connectionDocument.user_id,
            docRefItem.connection_record_id,
            attachmentUrl,
          );
          if (!exists) {
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
                  date: attachment?.creation || docRefItem.metadata?.date,
                  display_name: docRefItem.metadata?.display_name,
                },
              };

              await createDocument(db, cd);
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
