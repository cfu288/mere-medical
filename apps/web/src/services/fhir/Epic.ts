/**
 * Functions related to authenticating against the Epic MyChart patient portal and syncing data
 */

/* eslint-disable no-inner-declarations */
import {
  parseEpicTenantId,
  isEpicSandbox,
  parseEpicFhirBaseUrl,
} from './EpicUtils';
import { Bundle, BundleEntry, DocumentReference } from 'fhir/r2';
import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  ConnectionDocument,
  CreateEpicConnectionDocument,
  EpicConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { Routes } from '../../Routes';
import { DSTU2, R4 } from '.';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import { createConnection } from '../../repositories/ConnectionRepository';
import uuid4 from '../../shared/utils/UUIDUtils';
import { signJwt } from '@mere/crypto/browser';
import type { JsonWebKeySet } from '@mere/crypto';
import {
  createEpicClient,
  createEpicClientWithProxy,
  EPIC_DEFAULT_SCOPES,
  relativeFhirPathWithin,
  resolveFhirUrl,
  type ProxyTargetTypeOf,
  type OAuthConfig,
  type EpicTokenSet,
} from '@mere/fhir-oauth';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { CreateClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { findUserById } from '../../repositories/UserRepository';
import { getConnectionCardByTenant } from './getConnectionCardByUrl';
import {
  mapSearchedResources,
  mapCompanionResources,
  FhirBundleEntry,
  ResourceMapper,
  VendorSync,
} from './sync';
import {
  bulkUpsertDocuments,
  createDocument,
  documentExistsByMetadataId,
  findDocumentsByResourceType,
} from '../../repositories/ClinicalDocumentRepository';

const epicClient = createEpicClient({ signJwt });

/**
 * Builds a URL that routes an Epic request through this instance's proxy.
 */
export function epicProxyUrl(
  publicUrl: string,
  serviceId: string,
  params: { targetType: ProxyTargetTypeOf<'epic'>; target?: string },
): string {
  if (!publicUrl) {
    throw new Error('Cannot proxy a request without PUBLIC_URL configured');
  }
  const base = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`,
    url = new URL('api/proxy', base);
  url.searchParams.set('vendor', 'epic');
  url.searchParams.set('serviceId', serviceId);
  if (params.target !== undefined) {
    url.searchParams.set('target', params.target);
  }
  url.searchParams.set('target_type', params.targetType);
  return url.toString();
}

export const createProxiedEpicClient = (publicUrl: string) =>
  createEpicClientWithProxy({ signJwt }, (tenantId, targetType) =>
    epicProxyUrl(publicUrl, tenantId, { targetType }),
  );

export function getEpicClientId(
  config: AppConfig,
  version: 'DSTU2' | 'R4',
  isSandbox: boolean,
): string {
  if (isSandbox) {
    if (version === 'R4') {
      return (
        config.EPIC_SANDBOX_CLIENT_ID_R4 || config.EPIC_SANDBOX_CLIENT_ID || ''
      );
    }
    return (
      config.EPIC_SANDBOX_CLIENT_ID_DSTU2 || config.EPIC_SANDBOX_CLIENT_ID || ''
    );
  }

  if (version === 'R4') {
    return config.EPIC_CLIENT_ID_R4 || config.EPIC_CLIENT_ID || '';
  }
  return config.EPIC_CLIENT_ID_DSTU2 || config.EPIC_CLIENT_ID || '';
}

export { EPIC_DEFAULT_SCOPES as EPIC_SCOPES };

export enum EpicLocalStorageKeys {
  EPIC_BASE_URL = 'epicUrl',
  EPIC_NAME = 'epicName',
  EPIC_ID = 'epicId',
  EPIC_AUTH_URL = 'epicAuthUrl',
  EPIC_TOKEN_URL = 'epicTokenUrl',
  FHIR_VERSION = 'epicFhirVersion',
}

async function getFHIRResource<E extends FhirBundleEntry>(
  config: AppConfig,
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string | string[]>,
  useProxy = false,
): Promise<E[]> {
  const epicId = connectionDocument.tenant_id;
  const fhirUrl = baseUrl;

  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, v));
      } else {
        searchParams.append(key, value);
      }
    });
  }

  const query = searchParams.toString();

  let allEntries: E[] = [];
  let nextUrl: string | undefined = useProxy
    ? epicProxyUrl(config.PUBLIC_URL || '', epicId, {
        targetType: 'base',
        target: query ? `${fhirResourceUrl}?${query}` : fhirResourceUrl,
      })
    : resolveFhirUrl(fhirUrl, fhirResourceUrl, searchParams);

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
        Accept: 'application/fhir+json',
      },
    });
    if (!response.ok) {
      console.error(await response.text());
      throw new Error('Error getting FHIR resource');
    }
    const bundle: Bundle = await response.json();

    if (bundle.entry) {
      allEntries = allEntries.concat(bundle.entry as unknown as E[]);
    }

    const nextLink = bundle.link?.find(
      (link: { relation?: string; url?: string }) => link.relation === 'next',
    );
    if (nextLink?.url && useProxy) {
      const relativePath = relativeFhirPathWithin(nextLink.url, fhirUrl);
      if (relativePath === null) {
        throw new Error(
          `Pagination link points outside the FHIR server: ${nextLink.url}`,
        );
      }
      nextUrl = epicProxyUrl(config.PUBLIC_URL || '', epicId, {
        targetType: 'base',
        target: relativePath,
      });
    } else {
      nextUrl = nextLink?.url;
    }
  }

  return allEntries;
}

/**
 * Sync a FHIR resource to the database
 * @param baseUrl Base url of the FHIR server
 * @param connectionDocument EpicConnectionDocument connection document
 * @param db RxDatabase to save to
 * @param fhirResourceUrl URL path FHIR resource to sync. e.g. Patient, Procedure, etc. Exclude the leading slash.
 * @param mapper Function to map the FHIR resource to a ClinicalDocument
 * @param params Query parameters to pass to the FHIR request
 * @returns
 */
async function syncFHIRResource<E extends FhirBundleEntry>(
  config: AppConfig,
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: ResourceMapper<E, EpicConnectionDocument>,
  params: Record<string, string | string[]>,
  useProxy = false,
) {
  const resc = await getFHIRResource<E>(
    config,
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
    useProxy,
  );

  return bulkUpsertDocuments(
    db,
    mapSearchedResources(resc, fhirResourceUrl, mapper, connectionDocument),
  );
}

async function syncFHIRResourceWithIncludes<E extends FhirBundleEntry>(
  config: AppConfig,
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: ResourceMapper<E, EpicConnectionDocument>,
  params: Record<string, string | string[]>,
  includeMappers: Record<string, ResourceMapper<any, EpicConnectionDocument>>,
  useProxy = false,
) {
  const resc = await getFHIRResource<E>(
    config,
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
    useProxy,
  );

  await bulkUpsertDocuments(
    db,
    mapSearchedResources(resc, fhirResourceUrl, mapper, connectionDocument),
  );
  await bulkUpsertDocuments(
    db,
    mapCompanionResources(
      resc,
      includeMappers,
      connectionDocument,
      fhirResourceUrl,
    ),
  );
}

export const sync: VendorSync = {
  refreshToken: ({ config, connection, db, useProxy }) =>
    refreshEpicConnectionTokenIfNeeded(config, connection, db, useProxy),
  syncAllRecords: ({ config, connection, db, useProxy }) => {
    const cd = connection.toMutableJSON() as unknown as EpicConnectionDocument;
    const baseUrl = parseEpicFhirBaseUrl(cd.location);
    const patient = cd.patient;
    const version = cd.fhir_version || 'DSTU2';

    if (version === 'R4') {
      const includeMappers: Record<
        string,
        ResourceMapper<any, EpicConnectionDocument>
      > = {
        Specimen: R4.mapSpecimenToClinicalDocument,
        Provenance: R4.mapProvenanceToClinicalDocument,
        Location: R4.mapLocationToClinicalDocument,
        Organization: R4.mapOrganizationToClinicalDocument,
        PractitionerRole: R4.mapPractitionerRoleToClinicalDocument,
        RelatedPerson: R4.mapRelatedPersonToClinicalDocument,
        Media: R4.mapMediaToClinicalDocument,
      };
      return Promise.allSettled([
        syncFHIRResource(
          config,
          baseUrl,
          cd,
          db,
          'Procedure',
          R4.mapProcedureToClinicalDocument,
          { patient },
          useProxy,
        ),
        syncFHIRResource(
          config,
          baseUrl,
          cd,
          db,
          'Patient',
          R4.mapPatientToClinicalDocument,
          { id: patient },
          useProxy,
        ),
        syncFHIRResourceWithIncludes(
          config,
          baseUrl,
          cd,
          db,
          'Observation',
          R4.mapObservationToClinicalDocument,
          {
            patient,
            category: 'laboratory',
            _include: ['Observation:specimen', 'Observation:derived-from'],
            _revinclude: 'Provenance:target',
          },
          includeMappers,
          useProxy,
        ),
        syncFHIRResourceWithIncludes(
          config,
          baseUrl,
          cd,
          db,
          'DiagnosticReport',
          R4.mapDiagnosticReportToClinicalDocument,
          {
            patient,
            _include: ['DiagnosticReport:specimen', 'DiagnosticReport:media'],
            _revinclude: 'Provenance:target',
          },
          includeMappers,
          useProxy,
        ),
        syncFHIRResource(
          config,
          baseUrl,
          cd,
          db,
          'MedicationRequest',
          R4.mapMedicationRequestToClinicalDocument,
          { patient },
          useProxy,
        ),
        syncFHIRResource(
          config,
          baseUrl,
          cd,
          db,
          'Immunization',
          R4.mapImmunizationToClinicalDocument,
          { patient },
          useProxy,
        ),
        syncFHIRResource(
          config,
          baseUrl,
          cd,
          db,
          'Condition',
          R4.mapConditionToClinicalDocument,
          { patient },
          useProxy,
        ),
        syncFHIRResource(
          config,
          baseUrl,
          cd,
          db,
          'AllergyIntolerance',
          R4.mapAllergyIntoleranceToClinicalDocument,
          { patient },
          useProxy,
        ),
        syncDocumentReferences(
          config,
          baseUrl,
          cd,
          db,
          { patient },
          useProxy,
          'R4',
        ),
        syncFHIRResourceWithIncludes(
          config,
          baseUrl,
          cd,
          db,
          'MedicationDispense',
          R4.mapMedicationDispenseToClinicalDocument,
          { patient, _revinclude: 'Provenance:target' },
          includeMappers,
          useProxy,
        ),
        syncFHIRResourceWithIncludes(
          config,
          baseUrl,
          cd,
          db,
          'ServiceRequest',
          R4.mapServiceRequestToClinicalDocument,
          {
            patient,
            _include: 'ServiceRequest:specimen',
            _revinclude: 'Provenance:target',
          },
          includeMappers,
          useProxy,
        ),
        syncFHIRResourceWithIncludes(
          config,
          baseUrl,
          cd,
          db,
          'Goal',
          R4.mapGoalToClinicalDocument,
          { patient, _revinclude: 'Provenance:target' },
          includeMappers,
          useProxy,
        ),
        syncFHIRResourceWithIncludes(
          config,
          baseUrl,
          cd,
          db,
          'CareTeam',
          R4.mapCareTeamToClinicalDocument,
          {
            patient,
            _include: 'CareTeam:participant',
            _revinclude: 'Provenance:target',
          },
          includeMappers,
          useProxy,
        ),
        syncFHIRResourceWithIncludes(
          config,
          baseUrl,
          cd,
          db,
          'Coverage',
          R4.mapCoverageToClinicalDocument,
          {
            patient,
            _include: 'Coverage:payor',
            _revinclude: 'Provenance:target',
          },
          includeMappers,
          useProxy,
        ),
        syncFHIRResourceWithIncludes(
          config,
          baseUrl,
          cd,
          db,
          'Device',
          R4.mapDeviceToClinicalDocument,
          { patient, _revinclude: 'Provenance:target' },
          includeMappers,
          useProxy,
        ),
        syncFHIRResourceWithIncludes(
          config,
          baseUrl,
          cd,
          db,
          'Encounter',
          R4.mapEncounterToClinicalDocument,
          {
            patient,
            _include: [
              'Encounter:location',
              'Encounter:service-provider',
              'Encounter:practitioner',
            ],
            _revinclude: 'Provenance:target',
          },
          includeMappers,
          useProxy,
        ),
      ]);
    }

    return Promise.allSettled([
      syncFHIRResource(
        config,
        baseUrl,
        cd,
        db,
        'Procedure',
        DSTU2.mapProcedureToClinicalDocument,
        { patient },
        useProxy,
      ),
      syncFHIRResource(
        config,
        baseUrl,
        cd,
        db,
        'Patient',
        DSTU2.mapPatientToClinicalDocument,
        { id: patient },
        useProxy,
      ),
      syncFHIRResource(
        config,
        baseUrl,
        cd,
        db,
        'Observation',
        DSTU2.mapObservationToClinicalDocument,
        { patient, category: 'laboratory' },
        useProxy,
      ),
      syncFHIRResource(
        config,
        baseUrl,
        cd,
        db,
        'DiagnosticReport',
        DSTU2.mapDiagnosticReportToClinicalDocument,
        { patient },
        useProxy,
      ),
      syncFHIRResource(
        config,
        baseUrl,
        cd,
        db,
        'MedicationStatement',
        DSTU2.mapMedicationStatementToClinicalDocument,
        { patient },
        useProxy,
      ),
      syncFHIRResource(
        config,
        baseUrl,
        cd,
        db,
        'Immunization',
        DSTU2.mapImmunizationToClinicalDocument,
        { patient },
        useProxy,
      ),
      syncFHIRResource(
        config,
        baseUrl,
        cd,
        db,
        'Condition',
        DSTU2.mapConditionToClinicalDocument,
        { patient },
        useProxy,
      ),
      syncFHIRResource(
        config,
        baseUrl,
        cd,
        db,
        'AllergyIntolerance',
        DSTU2.mapAllergyIntoleranceToClinicalDocument,
        { patient },
        useProxy,
      ),
      syncDocumentReferences(
        config,
        baseUrl,
        cd,
        db,
        { patient },
        useProxy,
        'DSTU2',
      ),
      syncFHIRResource(
        config,
        baseUrl,
        cd,
        db,
        'CarePlan',
        DSTU2.mapCarePlanToClinicalDocument,
        { patient },
        useProxy,
      ),
    ]);
  },
};

async function syncDocumentReferences(
  config: AppConfig,
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
  useProxy = false,
  fhirVersion: 'DSTU2' | 'R4' = 'DSTU2',
) {
  await syncFHIRResource<BundleEntry<DocumentReference>>(
    config,
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    fhirVersion === 'R4'
      ? (R4.mapDocumentReferenceToClinicalDocument as ResourceMapper<
          BundleEntry<DocumentReference>,
          EpicConnectionDocument
        >)
      : DSTU2.mapDocumentReferenceToClinicalDocument,
    params,
    useProxy,
  );

  // format all the document references
  const docRefItems = await findDocumentsByResourceType<
    BundleEntry<DocumentReference>
  >(db, connectionDocument.user_id, connectionDocument.id, 'documentreference');
  // for each docref, get attachments and sync them
  const cdsmap = docRefItems.map(async (docRefItem) => {
    const attachments = docRefItem.data_record.raw.resource?.content.map(
      (a) => a.attachment,
    );
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
            const { contentType, raw } = await fetchAttachmentData(
              config,
              baseUrl,
              attachmentUrl,
              connectionDocument,
              useProxy,
            );
            if (raw && contentType) {
              // save as ClinicalDocument
              const cd: CreateClinicalDocument<string | Blob> = {
                user_id: connectionDocument.user_id,
                connection_record_id: connectionDocument.id,
                data_record: {
                  raw: raw,
                  format: fhirVersion === 'R4' ? 'FHIR.R4' : 'FHIR.DSTU2',
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
            } else {
              console.warn(
                '[syncDocumentReferences] Skipping attachment save - missing raw or contentType:',
                {
                  attachmentUrl,
                  hasRaw: !!raw,
                  contentType,
                },
              );
            }
          }
        }
      }
    }
  });
  return await Promise.all(cdsmap);
}

/**
 * Fetch attachment data from the FHIR server
 * @param url URL of the attachment
 * @param connectionDocument
 * @returns
 */
async function fetchAttachmentData(
  config: AppConfig,
  baseUrl: string,
  url: string,
  connectionDocument: EpicConnectionDocument,
  useProxy: boolean,
): Promise<{ contentType: string | null; raw: string | undefined }> {
  try {
    const epicId = connectionDocument.tenant_id;
    const isRelativeUrl =
      !url.startsWith('http://') && !url.startsWith('https://');
    const defaultUrl = isRelativeUrl ? resolveFhirUrl(baseUrl, url) : url;
    const relativePath = relativeFhirPathWithin(defaultUrl, baseUrl);
    const fetchUrl =
      useProxy && relativePath !== null
        ? epicProxyUrl(config.PUBLIC_URL || '', epicId, {
            targetType: 'base',
            target: relativePath,
          })
        : defaultUrl;
    const res = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${connectionDocument.access_token}` },
    });

    if (!res.ok) {
      console.error('[fetchAttachmentData] Fetch failed:', {
        status: res.status,
        statusText: res.statusText,
        url: fetchUrl,
      });
      throw new Error(
        'Could not get document as the user is unauthorized. Try logging in again.',
      );
    }
    const contentType = res.headers.get('Content-Type');
    let raw = undefined;

    if (
      contentType?.includes('text/') ||
      contentType?.includes('application/xml')
    ) {
      raw = await res.text();
    } else if (
      contentType?.includes('application/pdf') ||
      contentType?.includes('image/')
    ) {
      const blob = await res.blob();
      const reader = new FileReader();
      raw = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1]); // Extract base64 part
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else if (contentType) {
      raw = await res.text();
    } else {
      console.warn(
        '[fetchAttachmentData] No Content-Type header, attempting text download',
      );
      raw = await res.text();
    }

    return { contentType, raw };
  } catch (e) {
    console.error('[fetchAttachmentData] Exception:', e);
    throw new Error(
      'Could not get document as the user is unauthorized. Try logging in again.',
    );
  }
}

export async function saveConnectionToDb({
  res,
  epicBaseUrl: epicUrl,
  epicTokenUrl,
  epicAuthUrl,
  epicName,
  db,
  epicId,
  user,
  fhirVersion = 'DSTU2',
}: {
  res: EpicAuthResponseWithClientId | EpicAuthResponse;
  epicBaseUrl: string;
  epicTokenUrl: string;
  epicAuthUrl: string;
  epicName: string;
  db: RxDatabase<DatabaseCollections>;
  epicId: string;
  user: UserDocument;
  fhirVersion?: 'DSTU2' | 'R4';
}) {
  // TODO: a second patient at the same tenant overwrites the first - key on patient too
  const tenantId = parseEpicTenantId(epicId);
  const currentDoc = await getConnectionCardByTenant<EpicConnectionDocument>(
    'epic',
    tenantId,
    db,
    user.id,
  );
  return new Promise((resolve, reject) => {
    if (res?.access_token && res?.expires_in && res?.patient) {
      if (currentDoc) {
        // If we already have a connection card for this tenant, update it
        try {
          const nowInSeconds = Math.floor(Date.now() / 1000);
          currentDoc
            .update({
              $set: {
                client_id:
                  (res as EpicAuthResponseWithClientId)?.client_id ||
                  currentDoc.client_id,
                location: epicUrl,
                auth_uri: epicAuthUrl,
                token_uri: epicTokenUrl,
                access_token: res.access_token,
                expires_at: nowInSeconds + res.expires_in,
                scope: res.scope,
                patient: res.patient,
                tenant_id: tenantId,
                fhir_version: fhirVersion,
                last_sync_was_error: false,
              },
            })
            .then(() => {
              console.log('Updated connection card');
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
        const nowInSeconds = Math.floor(Date.now() / 1000);
        // Otherwise, create a new connection card
        const dbentry: Omit<CreateEpicConnectionDocument, 'refresh_token'> = {
          id: uuid4(),
          user_id: user.id,
          source: 'epic',
          location: epicUrl,
          auth_uri: epicAuthUrl,
          token_uri: epicTokenUrl,
          name: epicName,
          access_token: res.access_token,
          expires_at: nowInSeconds + res.expires_in,
          scope: res.scope,
          patient: res.patient,
          client_id: (res as EpicAuthResponseWithClientId)?.client_id,
          tenant_id: tenantId,
          fhir_version: fhirVersion,
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

/**
 * For a connection document, if the access token is expired, refresh it and save it to the db.
 * Uses the lib's epicClient.refresh() which handles JWT bearer token refresh.
 */
export async function refreshEpicConnectionTokenIfNeeded(
  config: AppConfig,
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false,
) {
  const clientId = connectionDocument.get('client_id');
  const currentTokens: EpicTokenSet = {
    accessToken: connectionDocument.get('access_token'),
    expiresAt: connectionDocument.get('expires_at'),
    refreshToken: connectionDocument.get('refresh_token'),
    clientId,
    patientId: connectionDocument.get('patient'),
    raw: {},
  };

  if (epicClient.isExpired(currentTokens, 0)) {
    try {
      const epicUrl = connectionDocument.get('location'),
        epicTokenUrl = connectionDocument.get('token_uri'),
        epicAuthUrl = connectionDocument.get('auth_uri'),
        epicName = connectionDocument.get('name'),
        epicId = connectionDocument.get('tenant_id'),
        userId = connectionDocument.get('user_id'),
        fhirVersion = (connectionDocument.get('fhir_version') || 'DSTU2') as
          | 'DSTU2'
          | 'R4';

      if (!clientId) {
        throw new Error(
          'No client_id found - dynamic registration may not have succeeded',
        );
      }

      const userObject = await findUserById(db, userId);
      if (!userObject) {
        throw new Error(`User not found: ${userId}`);
      }

      const fhirBaseUrl = parseEpicFhirBaseUrl(epicUrl),
        oauthConfig: OAuthConfig = {
          clientId: getEpicClientId(config, fhirVersion, isEpicSandbox(epicId)),
          redirectUri: `${config.PUBLIC_URL}${Routes.EpicCallback}`,
          scopes: ['openid', 'fhirUser'],
          tenant: {
            id: epicId,
            name: epicName,
            authUrl: epicAuthUrl,
            tokenUrl: epicTokenUrl,
            fhirBaseUrl,
            fhirVersion,
          },
        };

      const client = useProxy
        ? createProxiedEpicClient(config.PUBLIC_URL || '')
        : epicClient;
      const newTokens = await client.refresh(currentTokens, oauthConfig);

      return await saveConnectionToDb({
        res: {
          access_token: newTokens.accessToken,
          expires_in: newTokens.expiresAt - Math.floor(Date.now() / 1000),
          patient: newTokens.patientId || '',
          token_type: 'Bearer',
          scope: (newTokens.raw['scope'] as string) || '',
          refresh_token: newTokens.refreshToken || '',
          client_id: clientId,
        },
        epicBaseUrl: epicUrl,
        epicName,
        epicTokenUrl,
        epicAuthUrl,
        db,
        epicId,
        user: userObject,
        fhirVersion,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token - try logging in again');
    }
  }
  return Promise.resolve();
}

export interface EpicAuthResponse {
  access_token: string;
  expires_in: number;
  patient: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

export interface EpicAuthResponseWithClientId extends EpicAuthResponse {
  client_id: string;
}

export interface EpicDynamicRegistrationResponse {
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  grant_types: string[];
  software_id: string;
  client_id: string;
  client_id_issued_at: number;
  jwks: JsonWebKeySet;
}

export interface EpicDynamicRegistrationRequest {
  software_id: string;
  jwks: JsonWebKeySet;
}
