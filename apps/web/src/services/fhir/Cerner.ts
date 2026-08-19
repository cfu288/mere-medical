/**
 * Functions related to authenticating against the Cerner patient portal and syncing data
 */

/* eslint-disable no-inner-declarations */
import { Bundle, BundleEntry, DocumentReference } from 'fhir/r2';
import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  CernerConnectionDocument,
  ConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { DSTU2, R4 } from '.';
import { findUserById } from '../../repositories/UserRepository';
import { updateConnection } from '../../repositories/ConnectionRepository';
import { JsonWebKeySet } from '@mere/crypto';
import {
  createCernerClient,
  CERNER_DEFAULT_SCOPES,
  type OAuthConfig,
  type CernerTokenSet,
} from '@mere/fhir-oauth';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { CreateClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';
import { Routes } from '../../Routes';
import { AppConfig } from '../../app/providers/AppConfigProvider';
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

const cernerClient = createCernerClient();

export enum CernerLocalStorageKeys {
  CERNER_BASE_URL = 'cernerBaseUrl',
  CERNER_AUTH_URL = 'cernerAuthUrl',
  CERNER_TOKEN_URL = 'cernerTokenUrl',
  CERNER_NAME = 'cernerName',
  CERNER_ID = 'cernerId',
  FHIR_VERSION = 'cernerFhirVersion',
}

export const CERNER_SCOPES = CERNER_DEFAULT_SCOPES;

function parseIdToken(token: string) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    // eslint-disable-next-line no-restricted-globals
    self
      .atob(base64)
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(''),
  );

  return JSON.parse(jsonPayload) as {
    sub: string;
    aud: string;
    profile: string;
    iss: string;
    name: string;
    exp: number;
    iat: number;
    fhirUser: string;
    email: string;
  };
}

async function getFHIRResource<E extends FhirBundleEntry>(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
): Promise<E[]> {
  const defaultUrl = `${baseUrl}${fhirResourceUrl}?${new URLSearchParams(
    params,
  )}`;

  let allEntries: E[] = [];
  let nextUrl: string | undefined = defaultUrl;

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
      allEntries = allEntries.concat(bundle.entry as unknown as E[]);
    }

    const nextLink = bundle.link?.find(
      (link: { relation?: string; url?: string }) => link.relation === 'next',
    );
    nextUrl = nextLink?.url;
  }

  return allEntries;
}

/**
 * Sync a FHIR resource to the database
 * @param baseUrl Base url of the FHIR server
 * @param connectionDocument RxDocument of the connection document
 * @param db RxDatabase to save to
 * @param fhirResourceUrl URL path FHIR resource to sync. e.g. Patient, Procedure, etc. Exclude the leading slash.
 * @param mapper Function to map the FHIR resource to a CreateClinicalDocument
 * @param params Query parameters to pass to the FHIR request
 * @returns
 */
async function syncFHIRResource<E extends FhirBundleEntry>(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: ResourceMapper<E, CernerConnectionDocument>,
  params?: Record<string, string>,
) {
  const resc = await getFHIRResource<E>(
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

async function syncFHIRResourceWithIncludes<E extends FhirBundleEntry>(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: ResourceMapper<E, CernerConnectionDocument>,
  params: Record<string, string>,
  includeMappers: Record<string, ResourceMapper<any, CernerConnectionDocument>>,
) {
  const resc = await getFHIRResource<E>(
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
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
  refreshToken: ({ config, connection, db }) =>
    refreshCernerConnectionTokenIfNeeded(config, connection, db),
  syncAllRecords: ({ baseUrl, connection, db }) => {
    const cd =
      connection.toMutableJSON() as unknown as CernerConnectionDocument;
    const version = cd.fhir_version ?? 'DSTU2';
    const patient = parseIdToken(cd.id_token).fhirUser.split('/').slice(-1)[0];

    if (version === 'R4') {
      return Promise.allSettled([
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Procedure',
          R4.mapProcedureToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Patient',
          R4.mapPatientToClinicalDocument,
          { _id: patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Observation',
          R4.mapObservationToClinicalDocument,
          { patient, category: 'laboratory' },
        ),
        syncFHIRResourceWithIncludes(
          baseUrl,
          cd,
          db,
          'DiagnosticReport',
          R4.mapDiagnosticReportToClinicalDocument,
          { patient, _revinclude: 'Provenance:target' },
          {
            Specimen: R4.mapSpecimenToClinicalDocument,
            Media: R4.mapMediaToClinicalDocument,
            Provenance: R4.mapProvenanceToClinicalDocument,
          },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'MedicationRequest',
          R4.mapMedicationRequestToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Immunization',
          R4.mapImmunizationToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Condition',
          R4.mapConditionToClinicalDocument,
          { patient },
        ),
        syncDocumentReferences(baseUrl, cd, db, { patient }, 'R4'),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Encounter',
          R4.mapEncounterToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'AllergyIntolerance',
          R4.mapAllergyIntoleranceToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'CareTeam',
          R4.mapCareTeamToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Goal',
          R4.mapGoalToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Coverage',
          R4.mapCoverageToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Device',
          R4.mapDeviceToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'ServiceRequest',
          R4.mapServiceRequestToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'MedicationDispense',
          R4.mapMedicationDispenseToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'MedicationAdministration',
          R4.mapMedicationAdministrationToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Appointment',
          R4.mapAppointmentToClinicalDocument,
          { patient, date: 'ge1900-01-01T00:00:00Z' },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'FamilyMemberHistory',
          R4.mapFamilyMemberHistoryToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'Consent',
          R4.mapConsentToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'NutritionOrder',
          R4.mapNutritionOrderToClinicalDocument,
          { patient },
        ),
        syncFHIRResource(
          baseUrl,
          cd,
          db,
          'QuestionnaireResponse',
          R4.mapQuestionnaireResponseToClinicalDocument,
          { patient },
        ),
      ]);
    }

    return Promise.allSettled([
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Procedure',
        DSTU2.mapProcedureToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Patient',
        DSTU2.mapPatientToClinicalDocument,
        { _id: patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Observation',
        DSTU2.mapObservationToClinicalDocument,
        { patient, category: 'laboratory' },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'DiagnosticReport',
        DSTU2.mapDiagnosticReportToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'MedicationStatement',
        DSTU2.mapMedicationStatementToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Immunization',
        DSTU2.mapImmunizationToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Condition',
        DSTU2.mapConditionToClinicalDocument,
        { patient },
      ),
      syncDocumentReferences(baseUrl, cd, db, { patient }, 'DSTU2'),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Encounter',
        DSTU2.mapEncounterToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'AllergyIntolerance',
        DSTU2.mapAllergyIntoleranceToClinicalDocument,
        { patient },
      ),
    ]);
  },
};

async function syncDocumentReferences(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
  version: 'DSTU2' | 'R4' = 'DSTU2',
) {
  await syncFHIRResource<BundleEntry<DocumentReference>>(
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    version === 'R4'
      ? (R4.mapDocumentReferenceToClinicalDocument as ResourceMapper<
          BundleEntry<DocumentReference>,
          CernerConnectionDocument
        >)
      : DSTU2.mapDocumentReferenceToClinicalDocument,
    params,
  );

  // format all the document references
  const docRefItems = await findDocumentsByResourceType<
    BundleEntry<DocumentReference>
  >(db, connectionDocument.user_id, connectionDocument.id, 'documentreference');
  // for each docref, get attachments and sync them
  const cdsmap = docRefItems.map(async (docRefItem) => {
    const attachmentUrls = docRefItem.data_record.raw.resource?.content.map(
      (a) => a.attachment.url,
    );
    if (attachmentUrls) {
      for (const attachmentUrl of attachmentUrls) {
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
              // save as CreateClinicalDocument
              const cd: CreateClinicalDocument<string | Blob> = {
                user_id: connectionDocument.user_id,
                connection_record_id: connectionDocument.id,
                data_record: {
                  raw: raw,
                  format: version === 'R4' ? 'FHIR.R4' : 'FHIR.DSTU2',
                  content_type: contentType,
                  resource_type: 'documentreference_attachment',
                  version_history: [],
                },
                metadata: {
                  id: attachmentUrl,
                  date:
                    docRefItem.data_record.raw.resource?.created ||
                    docRefItem.data_record.raw.resource?.context?.period?.start,
                  display_name:
                    docRefItem.data_record.raw.resource?.type?.text ||
                    docRefItem.metadata?.display_name,
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

/**
 * Fetch attachment data from the FHIR server
 *
 * We use 'application/fhir+json' Accept header for all Binary resources,
 * which returns a JSON wrapper with base64-encoded data. Oracle recommends using the
 * actual contentType from DocumentReference.content.attachment.contentType instead,
 * which would return raw binary data directly. However, this would require passing
 * the contentType to this function. Consider refactoring in the future.
 *
 * @see https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/op-binary-id-get.html
 * @param url URL of the attachment
 * @param cd Connection document
 * @returns Object containing contentType and raw data (as base64 string for PDFs)
 */
async function fetchAttachmentData(
  url: string,
  cd: CernerConnectionDocument,
): Promise<{ contentType: string | null; raw: string | Blob | undefined }> {
  try {
    const isBinaryResource = url.includes('/Binary/');
    const acceptHeader = isBinaryResource ? 'application/fhir+json' : '*/*';

    const res = await fetch(url, {
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

async function updateConnectionTokens({
  res,
  cernerBaseUrl,
  db,
  user,
}: {
  res: CernerAuthResponseWithClientId | CernerAuthResponse;
  cernerBaseUrl: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) {
  const doc = await getConnectionCardByUrl<CernerConnectionDocument>(
    cernerBaseUrl,
    db,
    user.id,
  );

  if (!res?.access_token || !res?.expires_in) {
    throw new Error(
      'Error completing authentication: no access token provided',
    );
  }

  if (!doc) {
    throw new Error(
      'Connection document not found - cannot update non-existent connection',
    );
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  await updateConnection(db, user.id, doc.id, {
    access_token: res.access_token,
    expires_at: nowInSeconds + res.expires_in,
    scope: res.scope,
    last_sync_was_error: false,
    ...(res.id_token && { id_token: res.id_token }),
  });
}

/**
 * For a connection document, if the access token is expired, refresh it and save it to the db.
 * Uses the lib's cernerClient.refresh() which handles standard refresh_token grant.
 */
export async function refreshCernerConnectionTokenIfNeeded(
  config: AppConfig,
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  const refreshToken = connectionDocument.get('refresh_token');
  const currentTokens: CernerTokenSet = {
    accessToken: connectionDocument.get('access_token'),
    expiresAt: connectionDocument.get('expires_at'),
    refreshToken,
    raw: {},
  };

  if (cernerClient.isExpired(currentTokens, 0)) {
    try {
      const baseUrl = connectionDocument.get('location'),
        tokenUri = connectionDocument.get('token_uri'),
        authUri = connectionDocument.get('auth_uri'),
        name = connectionDocument.get('name'),
        cernerId =
          connectionDocument.get('tenant_id') || connectionDocument.get('id'),
        userId = connectionDocument.get('user_id'),
        fhirVersion = (connectionDocument.get('fhir_version') || 'DSTU2') as
          | 'DSTU2'
          | 'R4';

      if (!refreshToken) {
        throw new Error('No refresh_token found');
      }

      const userObject = await findUserById(db, userId);
      if (!userObject) {
        throw new Error(`User not found: ${userId}`);
      }

      const oauthConfig: OAuthConfig = {
        clientId: config.CERNER_CLIENT_ID || '',
        redirectUri: `${config.PUBLIC_URL}${Routes.CernerCallback}`,
        scopes: CERNER_SCOPES,
        tenant: {
          id: cernerId,
          name,
          authUrl: authUri,
          tokenUrl: tokenUri,
          fhirBaseUrl: baseUrl,
          fhirVersion,
        },
      };

      const newTokens = await cernerClient.refresh(currentTokens, oauthConfig);

      return await updateConnectionTokens({
        res: {
          access_token: newTokens.accessToken,
          expires_in: newTokens.expiresAt - Math.floor(Date.now() / 1000),
          scope: newTokens.scope || '',
          token_type: 'Bearer',
        },
        cernerBaseUrl: baseUrl,
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

export interface CernerAuthResponse {
  access_token: string;
  id_token?: string; // Optional for refresh token responses
  expires_in: number;
  patient?: string; // Optional for refresh token responses
  refresh_token?: string; // Optional for refresh token responses (not returned on refresh)
  scope: string;
  token_type: string;
}

export interface CernerAuthResponseWithClientId extends CernerAuthResponse {
  client_id: string;
  id_token: string; // Required for initial auth
  patient: string; // Required for initial auth
  refresh_token: string; // Required for initial auth
}

export interface CernerDynamicRegistrationResponse {
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  grant_types: string[];
  software_id: string;
  client_id: string;
  client_id_issued_at: number;
  jwks: JsonWebKeySet;
}

export interface CernerDynamicRegistrationRequest {
  software_id: string;
  jwks: JsonWebKeySet;
}
