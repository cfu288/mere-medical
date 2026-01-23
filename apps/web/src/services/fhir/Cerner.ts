/**
 * Functions related to authenticating against the Cerner patient portal and syncing data
 */

/* eslint-disable no-inner-declarations */
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
  MedicationStatement,
  Observation,
  Patient,
  Procedure,
} from 'fhir/r2';
import {
  MedicationRequest,
  CarePlan,
  CareTeam,
  Goal,
  Coverage,
  Device,
  ServiceRequest,
  Media,
  Specimen,
  RelatedPerson,
  MedicationDispense,
  MedicationAdministration,
  Appointment,
  FamilyMemberHistory,
  Consent,
  Contract,
  InsurancePlan,
  NutritionOrder,
  Questionnaire,
  QuestionnaireResponse,
  Person,
} from 'fhir/r4';
import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  CernerConnectionDocument,
  ConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { DSTU2, R4 } from '.';
import { findUserById } from '../../repositories/UserRepository';
import { JsonWebKeySet } from '@mere/crypto';
import {
  createCernerClient,
  CERNER_DEFAULT_SCOPES,
  type OAuthConfig,
  type CernerTokenSet,
} from '@mere/fhir-oauth';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../../models/clinical-document/ClinicalDocument.type';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';
import { Routes } from '../../Routes';
import { AppConfig } from '../../app/providers/AppConfigProvider';

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

async function getFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
): Promise<BundleEntry<T>[]> {
  const defaultUrl = `${baseUrl}${fhirResourceUrl}?${new URLSearchParams(
    params,
  )}`;

  let allEntries: BundleEntry<T>[] = [];
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
      allEntries = allEntries.concat(bundle.entry as BundleEntry<T>[]);
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
async function syncFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
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

async function processIncludedResources(
  entries: BundleEntry<any>[],
  mappers: Record<
    string,
    (entry: BundleEntry<any>) => CreateClinicalDocument<BundleEntry<any>>
  >,
  db: RxDatabase<DatabaseCollections>,
  excludeResourceTypes: string[] = [],
): Promise<void> {
  const resourceTypeGroups = new Map<string, BundleEntry<any>[]>();
  for (const entry of entries) {
    const resourceType = entry.resource?.resourceType;
    if (resourceType && !excludeResourceTypes.includes(resourceType)) {
      if (!resourceTypeGroups.has(resourceType)) {
        resourceTypeGroups.set(resourceType, []);
      }
      resourceTypeGroups.get(resourceType)!.push(entry);
    }
  }
  for (const [resourceType, groupedEntries] of resourceTypeGroups.entries()) {
    const mapper = mappers[resourceType];
    if (mapper) {
      const cds = groupedEntries.map(mapper);
      await db.clinical_documents.bulkUpsert(
        cds as unknown as ClinicalDocument[],
      );
    }
  }
}

async function syncFHIRResourceWithIncludes<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params: Record<string, string>,
  includeMappers: Record<
    string,
    (entry: BundleEntry<any>) => CreateClinicalDocument<BundleEntry<any>>
  >,
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
  await db.clinical_documents.bulkUpsert(cds as unknown as ClinicalDocument[]);
  await processIncludedResources(resc, includeMappers, db, [fhirResourceUrl]);
}

/**
 * Sync all records from the FHIR server to the local database
 * @param baseUrl Base url of the FHIR server to sync from
 * @param connectionDocument
 * @param db
 * @param version FHIR version to use for mapping (defaults to DSTU2 for backward compatibility)
 * @returns A promise of void arrays
 */
export async function syncAllRecords(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  version: 'DSTU2' | 'R4' = 'DSTU2',
): Promise<PromiseSettledResult<void[]>[]> {
  const mappers = version === 'R4' ? R4 : DSTU2;

  const procMapper = (proc: BundleEntry<Procedure>) =>
    mappers.mapProcedureToClinicalDocument(proc as any, connectionDocument);
  const patientMapper = (pt: BundleEntry<Patient>) =>
    mappers.mapPatientToClinicalDocument(pt as any, connectionDocument);
  const obsMapper = (imm: BundleEntry<Observation>) =>
    mappers.mapObservationToClinicalDocument(imm as any, connectionDocument);
  const drMapper = (dr: BundleEntry<DiagnosticReport>) =>
    mappers.mapDiagnosticReportToClinicalDocument(
      dr as any,
      connectionDocument,
    );
  const medStatementMapper = (dr: BundleEntry<MedicationStatement>) =>
    mappers.mapMedicationStatementToClinicalDocument(
      dr as any,
      connectionDocument,
    );
  const medRequestMapper = (dr: BundleEntry<MedicationRequest>) =>
    version === 'R4'
      ? R4.mapMedicationRequestToClinicalDocument(dr as any, connectionDocument)
      : medStatementMapper(dr as any);
  const immMapper = (dr: BundleEntry<Immunization>) =>
    mappers.mapImmunizationToClinicalDocument(dr as any, connectionDocument);
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    mappers.mapConditionToClinicalDocument(dr as any, connectionDocument);
  const allergyIntoleranceMapper = (a: BundleEntry<AllergyIntolerance>) =>
    mappers.mapAllergyIntoleranceToClinicalDocument(
      a as any,
      connectionDocument,
    );

  const encounterMapper = (a: BundleEntry<Encounter>) =>
    mappers.mapEncounterToClinicalDocument(a as any, connectionDocument);

  const specimenMapper = (s: any) =>
    R4.mapSpecimenToClinicalDocument(s, connectionDocument);
  const mediaMapper = (m: any) =>
    R4.mapMediaToClinicalDocument(m, connectionDocument);
  const provenanceMapper = (p: any) =>
    R4.mapProvenanceToClinicalDocument(p, connectionDocument);

  const includeMappers: Record<string, (entry: any) => any> = {
    Specimen: specimenMapper,
    Media: mediaMapper,
    Provenance: provenanceMapper,
  };

  const patientId = parseIdToken(connectionDocument.id_token)
    .fhirUser.split('/')
    .slice(-1)[0];

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Procedure>(
      baseUrl,
      connectionDocument,
      db,
      'Procedure',
      procMapper as any,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<Patient>(
      baseUrl,
      connectionDocument,
      db,
      'Patient',
      patientMapper as any,
      {
        _id: patientId,
      },
    ),
    syncFHIRResource<Observation>(
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper as any,
      {
        patient: patientId,
        category: 'laboratory',
      },
    ),
    version === 'R4'
      ? syncFHIRResourceWithIncludes<DiagnosticReport>(
          baseUrl,
          connectionDocument,
          db,
          'DiagnosticReport',
          drMapper as any,
          {
            patient: patientId,
            _revinclude: 'Provenance:target',
          },
          includeMappers,
        )
      : syncFHIRResource<DiagnosticReport>(
          baseUrl,
          connectionDocument,
          db,
          'DiagnosticReport',
          drMapper as any,
          {
            patient: patientId,
          },
        ),
    version === 'R4'
      ? syncFHIRResource<any>(
          baseUrl,
          connectionDocument,
          db,
          'MedicationRequest',
          medRequestMapper as any,
          {
            patient: patientId,
          },
        )
      : syncFHIRResource<MedicationStatement>(
          baseUrl,
          connectionDocument,
          db,
          'MedicationStatement',
          medStatementMapper as any,
          {
            patient: patientId,
          },
        ),
    syncFHIRResource<Immunization>(
      baseUrl,
      connectionDocument,
      db,
      'Immunization',
      immMapper as any,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<Condition>(
      baseUrl,
      connectionDocument,
      db,
      'Condition',
      conditionMapper as any,
      {
        patient: patientId,
      },
    ),
    syncDocumentReferences(
      baseUrl,
      connectionDocument,
      db,
      {
        patient: patientId,
      },
      version,
    ),
    syncFHIRResource<Encounter>(
      baseUrl,
      connectionDocument,
      db,
      'Encounter',
      encounterMapper as any,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<AllergyIntolerance>(
      baseUrl,
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper as any,
      {
        patient: patientId,
      },
    ),
    ...(version === 'R4'
      ? [
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'CareTeam',
            ((item: any) =>
              R4.mapCareTeamToClinicalDocument(
                item,
                connectionDocument,
              )) as any,
            { patient: patientId },
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'Goal',
            ((item: any) =>
              R4.mapGoalToClinicalDocument(item, connectionDocument)) as any,
            { patient: patientId },
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'Coverage',
            ((item: any) =>
              R4.mapCoverageToClinicalDocument(
                item,
                connectionDocument,
              )) as any,
            { patient: patientId },
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'Device',
            ((item: any) =>
              R4.mapDeviceToClinicalDocument(item, connectionDocument)) as any,
            { patient: patientId },
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'ServiceRequest',
            ((item: any) =>
              R4.mapServiceRequestToClinicalDocument(
                item,
                connectionDocument,
              )) as any,
            { patient: patientId },
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'MedicationDispense',
            ((item: any) =>
              R4.mapMedicationDispenseToClinicalDocument(
                item,
                connectionDocument,
              )) as any,
            { patient: patientId },
          ),
          syncFHIRResource(
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
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'Appointment',
            ((item: any) =>
              R4.mapAppointmentToClinicalDocument(
                item,
                connectionDocument,
              )) as any,
            { patient: patientId, date: 'ge1900-01-01T00:00:00Z' },
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'FamilyMemberHistory',
            ((item: any) =>
              R4.mapFamilyMemberHistoryToClinicalDocument(
                item,
                connectionDocument,
              )) as any,
            { patient: patientId },
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'Consent',
            ((item: any) =>
              R4.mapConsentToClinicalDocument(item, connectionDocument)) as any,
            { patient: patientId },
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'NutritionOrder',
            ((item: any) =>
              R4.mapNutritionOrderToClinicalDocument(
                item,
                connectionDocument,
              )) as any,
            { patient: patientId },
          ),
          syncFHIRResource(
            baseUrl,
            connectionDocument,
            db,
            'QuestionnaireResponse',
            ((item: any) =>
              R4.mapQuestionnaireResponseToClinicalDocument(
                item,
                connectionDocument,
              )) as any,
            { patient: patientId },
          ),
        ]
      : []),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

async function syncDocumentReferences(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
  version: 'DSTU2' | 'R4' = 'DSTU2',
) {
  const mappers = version === 'R4' ? R4 : DSTU2;
  const documentReferenceMapper = (dr: BundleEntry<DocumentReference>) =>
    mappers.mapDocumentReferenceToClinicalDocument(
      dr as any,
      connectionDocument,
    );
  await syncFHIRResource<DocumentReference>(
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    documentReferenceMapper as any,
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
      doc.toMutableJSON() as unknown as CreateClinicalDocument<
        BundleEntry<DocumentReference>
      >,
  );
  // for each docref, get attachments and sync them
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

              await db.clinical_documents.insert(
                cd as unknown as ClinicalDocument<string | Blob>,
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
  const updateData: Record<string, unknown> = {
    access_token: res.access_token,
    expires_at: nowInSeconds + res.expires_in,
    scope: res.scope,
    last_sync_was_error: false,
  };

  if (res.id_token) {
    updateData['id_token'] = res.id_token;
  }

  await doc.update({ $set: updateData });
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
