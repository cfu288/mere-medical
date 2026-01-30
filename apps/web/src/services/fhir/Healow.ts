/**
 * Healow FHIR R4 Integration
 *
 * This module supports two OAuth modes based on server configuration:
 *
 * PUBLIC CLIENT MODE (config.HEALOW_CONFIDENTIAL_MODE = false):
 *   - Only HEALOW_CLIENT_ID is configured on the server
 *   - Uses PKCE (code_verifier/code_challenge) for security
 *   - Token exchange happens via proxy to work around CORS
 *   - NO refresh tokens - Healow doesn't issue them to public clients
 *   - Users must re-authenticate when access token expires (~1 hour)
 *
 * CONFIDENTIAL CLIENT MODE (config.HEALOW_CONFIDENTIAL_MODE = true):
 *   - Both HEALOW_CLIENT_ID and HEALOW_CLIENT_SECRET configured on server
 *   - Token exchange goes through /api/v1/healow/token endpoint
 *   - Server injects client_secret (never exposed to browser)
 *   - Requests offline_access scope to enable refresh tokens
 *   - Token refresh via /api/v1/healow/refresh endpoint
 *   - Better UX - background token refresh without re-authentication
 *
 * @see https://connect4.healow.com/apps/jsp/dev/r4/fhirClinicalDocumentation.jsp#SymmetricAuthentication
 * @see https://connect4.healow.com/apps/jsp/dev/r4/fhirClinicalDocumentation.jsp#HealowSupportedScopes
 */
import {
  AllergyIntolerance,
  Bundle,
  BundleEntry,
  Condition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FhirResource,
  Immunization,
  Observation,
  Patient,
  Procedure,
} from 'fhir/r4';
import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  ConnectionDocument,
  CreateHealowConnectionDocument,
  HealowConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { Routes } from '../../Routes';
import { R4 } from '.';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import { createConnection } from '../../repositories/ConnectionRepository';
import { findUserById } from '../../repositories/UserRepository';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import uuid4 from '../../shared/utils/UUIDUtils';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../../models/clinical-document/ClinicalDocument.type';
import { concatPath } from '../../shared/utils/urlUtils';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';
import {
  createHealowClient,
  createHealowClientWithProxy,
  createHealowClientConfidential,
  buildHealowOAuthConfig,
  extractHealowPatientId,
  extractRelativeFhirPath,
  type HealowTokenSet,
} from '@mere/fhir-oauth';

export {
  createHealowClient,
  createHealowClientWithProxy,
  createHealowClientConfidential,
  buildHealowOAuthConfig,
  extractHealowPatientId,
  HEALOW_DEFAULT_SCOPES,
  type HealowClient,
  type HealowApiEndpoints,
  type HealowProxyUrlBuilder,
  type HealowTokenSet,
  type HealowOAuthConfigOptions,
} from '@mere/fhir-oauth';

export enum HealowLocalStorageKeys {
  HEALOW_BASE_URL = 'healowBaseUrl',
  HEALOW_AUTH_URL = 'healowAuthUrl',
  HEALOW_TOKEN_URL = 'healowTokenUrl',
  HEALOW_NAME = 'healowName',
  HEALOW_ID = 'healowId',
}

async function getFHIRResource<T extends FhirResource>(
  publicUrl: string,
  baseUrl: string,
  connectionDocument: HealowConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
  useProxy = true,
): Promise<BundleEntry<T>[]> {
  const searchParams = new URLSearchParams(params);
  const defaultUrl = `${concatPath(baseUrl, fhirResourceUrl)}?${searchParams}`;
  const proxyUrl = concatPath(
    publicUrl || '',
    `/api/proxy?vendor=healow&serviceId=${connectionDocument.tenant_id}&target=${encodeURIComponent(
      `${fhirResourceUrl}?${searchParams}`,
    )}&target_type=base`,
  );

  let allEntries: BundleEntry<T>[] = [];
  let nextUrl: string | undefined = useProxy ? proxyUrl : defaultUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
        Accept: 'application/json+fhir',
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
    if (nextLink?.url && useProxy) {
      const relativePath = extractRelativeFhirPath(nextLink.url, baseUrl);
      nextUrl = concatPath(
        publicUrl || '',
        `/api/proxy?vendor=healow&serviceId=${connectionDocument.tenant_id}&target=${encodeURIComponent(
          relativePath,
        )}&target_type=base`,
      );
    } else {
      nextUrl = nextLink?.url;
    }
  }

  return allEntries;
}

async function syncFHIRResource<T extends FhirResource>(
  publicUrl: string,
  baseUrl: string,
  connectionDocument: HealowConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params?: Record<string, string>,
  useProxy = true,
) {
  const resc = await getFHIRResource<T>(
    publicUrl,
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
    useProxy,
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
  publicUrl: string,
  baseUrl: string,
  connectionDocument: HealowConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  useProxy = true,
): Promise<PromiseSettledResult<void[]>[]> {
  const procMapper = (proc: BundleEntry<Procedure>) =>
    R4.mapProcedureToClinicalDocument(proc, connectionDocument);
  const patientMapper = (pt: BundleEntry<Patient>) =>
    R4.mapPatientToClinicalDocument(pt, connectionDocument);
  const obsMapper = (imm: BundleEntry<Observation>) =>
    R4.mapObservationToClinicalDocument(imm, connectionDocument);
  const drMapper = (dr: BundleEntry<DiagnosticReport>) =>
    R4.mapDiagnosticReportToClinicalDocument(dr, connectionDocument);
  const medRequestMapper = (dr: BundleEntry<any>) =>
    R4.mapMedicationRequestToClinicalDocument(dr, connectionDocument);
  const immMapper = (dr: BundleEntry<Immunization>) =>
    R4.mapImmunizationToClinicalDocument(dr, connectionDocument);
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    R4.mapConditionToClinicalDocument(dr, connectionDocument);
  const allergyIntoleranceMapper = (a: BundleEntry<AllergyIntolerance>) =>
    R4.mapAllergyIntoleranceToClinicalDocument(a, connectionDocument);
  const encounterMapper = (a: BundleEntry<Encounter>) =>
    R4.mapEncounterToClinicalDocument(a, connectionDocument);

  const patientId = extractHealowPatientId(connectionDocument.id_token);

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Procedure>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Procedure',
      procMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<Patient>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Patient',
      patientMapper as any,
      { _id: patientId },
      useProxy,
    ),
    syncFHIRResource<Observation>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper as any,
      { patient: patientId, category: 'laboratory' },
      useProxy,
    ),
    syncFHIRResource<DiagnosticReport>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'DiagnosticReport',
      drMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<any>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'MedicationRequest',
      medRequestMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<Immunization>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Immunization',
      immMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<Condition>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Condition',
      conditionMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncDocumentReferences(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      {
        patient: patientId,
      },
      useProxy,
    ),
    syncFHIRResource<Encounter>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Encounter',
      encounterMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<AllergyIntolerance>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'CareTeam',
      ((item: any) =>
        R4.mapCareTeamToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Goal',
      ((item: any) =>
        R4.mapGoalToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'CarePlan',
      ((item: any) =>
        R4.mapCarePlanToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Device',
      ((item: any) =>
        R4.mapDeviceToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<Observation>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper as any,
      { patient: patientId, category: 'vital-signs' },
      useProxy,
    ),
    syncFHIRResource<Observation>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper as any,
      { patient: patientId, category: 'social-history' },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'MedicationAdministration',
      ((item: any) =>
        R4.mapMedicationAdministrationToClinicalDocument(
          item,
          connectionDocument,
        )) as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Provenance',
      ((item: any) =>
        R4.mapProvenanceToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
      useProxy,
    ),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

async function syncDocumentReferences(
  publicUrl: string,
  baseUrl: string,
  connectionDocument: HealowConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
  useProxy = true,
) {
  const documentReferenceMapper = (dr: BundleEntry<DocumentReference>) =>
    R4.mapDocumentReferenceToClinicalDocument(dr, connectionDocument);
  await syncFHIRResource<DocumentReference>(
    publicUrl,
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    documentReferenceMapper as any,
    params,
    useProxy,
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

  const docRefItems = docs.map(
    (doc) =>
      doc.toMutableJSON() as unknown as CreateClinicalDocument<
        BundleEntry<DocumentReference>
      >,
  );
  const cdsmap = docRefItems.map(async (docRefItem) => {
    const attachmentUrls = docRefItem.data_record.raw.resource?.content.map(
      (a) => a.attachment.url,
    );
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
            const { contentType, raw } = await fetchAttachmentData(
              publicUrl,
              attachmentUrl,
              connectionDocument,
              useProxy,
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
                cd as unknown as ClinicalDocument<string | Blob>,
              );
            }
          }
        }
      }
    }
  });
  return await Promise.all(cdsmap);
}

async function fetchAttachmentData(
  publicUrl: string,
  url: string,
  cd: HealowConnectionDocument,
  useProxy = true,
): Promise<{ contentType: string | null; raw: string | Blob | undefined }> {
  try {
    const isBinaryResource = url.includes('/Binary/');
    const acceptHeader = isBinaryResource ? 'application/fhir+json' : '*/*';

    const isRelativeUrl =
      !url.startsWith('http://') && !url.startsWith('https://');
    const baseUrl = cd.location as string;
    const fullUrl = isRelativeUrl ? concatPath(baseUrl, url) : url;
    const proxyUrlExtension = fullUrl.replace(baseUrl, '');
    const proxyUrl = concatPath(
      publicUrl || '',
      `/api/proxy?vendor=healow&serviceId=${cd.tenant_id}&target=${encodeURIComponent(
        proxyUrlExtension,
      )}&target_type=base`,
    );

    const res = await fetch(useProxy ? proxyUrl : fullUrl, {
      headers: {
        Authorization: `Bearer ${cd.access_token}`,
        Accept: acceptHeader,
      },
    });
    if (!res.ok) {
      throw new Error(
        'Could not get document as the user is unauthorized. Try logging in again.',
      );
    }
    const contentType = res.headers.get('Content-Type');
    let raw = undefined;

    if (
      contentType?.includes('application/fhir+json') ||
      contentType?.includes('application/json+fhir')
    ) {
      const binaryResource = await res.json();
      if (binaryResource.data) {
        const actualContentType =
          binaryResource.contentType || 'application/octet-stream';

        if (actualContentType === 'application/pdf') {
          raw = binaryResource.data;
        } else if (
          actualContentType === 'application/xml' ||
          actualContentType.includes('text')
        ) {
          raw = atob(binaryResource.data);
        } else {
          raw = binaryResource.data;
        }

        return { contentType: actualContentType, raw };
      }
    } else if (contentType === 'application/xml') {
      raw = await res.text();
    }

    return { contentType, raw };
  } catch (e) {
    throw new Error(
      'Could not get document as the user is unauthorized. Try logging in again.',
    );
  }
}

export async function saveConnectionToDb({
  tokens,
  healowBaseUrl,
  healowName,
  healowAuthUrl,
  healowTokenUrl,
  healowId,
  db,
  user,
}: {
  tokens: HealowTokenSet;
  healowBaseUrl: string;
  healowName: string;
  healowAuthUrl: string;
  healowTokenUrl: string;
  healowId: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) {
  const doc = await getConnectionCardByUrl<HealowConnectionDocument>(
    healowBaseUrl,
    db,
    user.id,
  );
  return new Promise((resolve, reject) => {
    if (tokens?.accessToken) {
      if (doc) {
        try {
          const updateData: Record<string, unknown> = {
            access_token: tokens.accessToken,
            expires_at: tokens.expiresAt,
            scope: tokens.scope,
            last_sync_was_error: false,
          };

          if (tokens.idToken) {
            updateData['id_token'] = tokens.idToken;
          }

          if (tokens.refreshToken) {
            updateData['refresh_token'] = tokens.refreshToken;
          }

          doc
            .update({
              $set: updateData,
            })
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
      } else {
        if (!tokens.idToken) {
          reject(
            new Error('Connection document not found during token refresh'),
          );
          return;
        }

        const dbentry: CreateHealowConnectionDocument = {
          id: uuid4(),
          user_id: user.id,
          source: 'healow',
          location: healowBaseUrl,
          name: healowName,
          access_token: tokens.accessToken,
          expires_at: tokens.expiresAt,
          scope: tokens.scope,
          id_token: tokens.idToken,
          refresh_token: tokens.refreshToken,
          auth_uri: healowAuthUrl,
          token_uri: healowTokenUrl,
          tenant_id: healowId,
        };
        try {
          createConnection(db, dbentry as ConnectionDocument)
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

function buildHealowProxyUrlBuilder(publicUrl: string) {
  return (tenantId: string, targetType: 'token' | 'base') =>
    concatPath(
      publicUrl,
      `/api/proxy?vendor=healow&serviceId=${tenantId}&target_type=${targetType}`,
    );
}

export async function refreshHealowConnectionTokenIfNeeded(
  config: AppConfig,
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false,
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_at') <= nowInSeconds) {
    if (!config.HEALOW_CONFIDENTIAL_MODE) {
      throw new Error('Login expired - login required in order to sync data');
    }

    try {
      const baseUrl = connectionDocument.get('location'),
        refreshToken = connectionDocument.get('refresh_token'),
        tokenUri = connectionDocument.get('token_uri'),
        authUri = connectionDocument.get('auth_uri'),
        name = connectionDocument.get('name'),
        userId = connectionDocument.get('user_id'),
        tenantId = connectionDocument.get('tenant_id'),
        scope = connectionDocument.get('scope'),
        idToken = connectionDocument.get('id_token');

      const userObject = await findUserById(db, userId);

      if (!userObject) {
        throw new Error(`User not found: ${userId}`);
      }

      const client = config.HEALOW_CONFIDENTIAL_MODE
        ? createHealowClientConfidential({
            token: concatPath(config.PUBLIC_URL || '', '/api/v1/healow/token'),
            refresh: concatPath(
              config.PUBLIC_URL || '',
              '/api/v1/healow/refresh',
            ),
          })
        : useProxy
          ? createHealowClientWithProxy(
              buildHealowProxyUrlBuilder(config.PUBLIC_URL || ''),
            )
          : createHealowClient();

      const oauthConfig = buildHealowOAuthConfig({
        clientId: config.HEALOW_CLIENT_ID || '',
        publicUrl: config.PUBLIC_URL || '',
        redirectPath: Routes.HealowCallback,
        confidentialMode: config.HEALOW_CONFIDENTIAL_MODE,
        tenant: {
          id: tenantId,
          name,
          authUrl: authUri,
          tokenUrl: tokenUri,
          fhirBaseUrl: baseUrl,
        },
      });

      const currentTokens: HealowTokenSet = {
        accessToken: connectionDocument.get('access_token'),
        expiresAt: connectionDocument.get('expires_at'),
        idToken,
        refreshToken,
        scope,
        tenantId,
        raw: {},
      };

      const newTokens = await client.refresh(currentTokens, oauthConfig);

      return await saveConnectionToDb({
        tokens: newTokens,
        healowBaseUrl: baseUrl,
        healowName: name,
        healowAuthUrl: authUri,
        healowTokenUrl: tokenUri,
        healowId: tenantId,
        db,
        user: userObject,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token - try logging in again');
    }
  }
  return Promise.resolve();
}
