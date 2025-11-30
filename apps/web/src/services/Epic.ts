/**
 * Functions related to authenticating against the Epic MyChart patient portal and syncing data
 */

/* eslint-disable no-inner-declarations */
import { isEpicSandbox } from './EpicUtils';
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
import {
  MedicationRequest,
  MedicationDispense,
  ServiceRequest,
  Goal,
  CareTeam,
  Coverage,
  Device,
  Media,
  Specimen,
  Provenance,
  RelatedPerson,
  Location as FhirLocation,
  Organization,
  PractitionerRole,
  Encounter,
} from 'fhir/r4';
import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import {
  ConnectionDocument,
  CreateEpicConnectionDocument,
  EpicConnectionDocument,
} from '../models/connection-document/ConnectionDocument.type';
import { Routes } from '../Routes';
import { DSTU2, R4 } from '.';
import Config from '../environments/config.json';
import { createConnection } from '../repositories/ConnectionRepository';
import uuid4 from '../utils/UUIDUtils';
import { JsonWebKeyWKid, signJwt } from './JWTTools';
import { getPublicKey, IDBKeyConfig } from './WebCrypto';
import { JsonWebKeySet } from '../services/JWTTools';
import { UserDocument } from '../models/user-document/UserDocument.type';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../models/clinical-document/ClinicalDocument.type';
import { findUserById } from '../repositories/UserRepository';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';

const URLJoin = (...args: string[]) =>
  args
    .join('/')
    .replace(/[\/]+/g, '/')
    .replace(/^(.+):\//, '$1://')
    .replace(/^file:/, 'file:/')
    .replace(/\/(\?|&|#[^!])/g, '$1')
    .replace(/\?/g, '&')
    .replace('&', '?');

export function getDSTU2Url(baseUrl: string) {
  return isDSTU2Url(baseUrl)
    ? new URL(baseUrl).toString()
    : new URL('/api/FHIR/DSTU2/', baseUrl).toString();
}

export function isDSTU2Url(url: string) {
  return url.includes('/api/FHIR/DSTU2');
}

export function getR4Url(baseUrl: string) {
  return isR4Url(baseUrl)
    ? new URL(baseUrl).toString()
    : new URL('/api/FHIR/R4/', baseUrl).toString();
}

export function isR4Url(url: string) {
  return url.includes('/api/FHIR/R4');
}

export function getEpicClientId(
  version: 'DSTU2' | 'R4',
  isSandbox: boolean,
): string {
  if (isSandbox) {
    if (version === 'R4') {
      return (
        Config.EPIC_SANDBOX_CLIENT_ID_R4 ||
        Config.EPIC_SANDBOX_CLIENT_ID ||
        ''
      );
    }
    return (
      Config.EPIC_SANDBOX_CLIENT_ID_DSTU2 ||
      Config.EPIC_SANDBOX_CLIENT_ID ||
      ''
    );
  }

  if (version === 'R4') {
    return Config.EPIC_CLIENT_ID_R4 || Config.EPIC_CLIENT_ID || '';
  }
  return Config.EPIC_CLIENT_ID_DSTU2 || Config.EPIC_CLIENT_ID || '';
}

export function getLoginUrl(
  baseUrl: string,
  authorizeUrl: string,
  isSandbox = false,
  version: 'DSTU2' | 'R4' = 'DSTU2',
): string & Location {
  const params = {
    client_id: getEpicClientId(version, isSandbox),
    scope: 'openid fhirUser',
    redirect_uri: `${Config.PUBLIC_URL}${Routes.EpicCallback}`,
    aud: version === 'R4' ? getR4Url(baseUrl) : getDSTU2Url(baseUrl),
    response_type: 'code',
  };

  // return `${baseUrl}/oauth2/authorize?${new URLSearchParams(
  //   params
  // )}` as string & Location;
  return `${authorizeUrl}?${new URLSearchParams(params)}` as string & Location;
}

export enum EpicLocalStorageKeys {
  EPIC_BASE_URL = 'epicUrl',
  EPIC_NAME = 'epicName',
  EPIC_ID = 'epicId',
  EPIC_AUTH_URL = 'epicAuthUrl',
  EPIC_TOKEN_URL = 'epicTokenUrl',
  FHIR_VERSION = 'epicFhirVersion',
}

async function getFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string | string[]>,
  useProxy = false,
): Promise<BundleEntry<T>[]> {
  const epicId = connectionDocument.tenant_id;
  const fhirVersion = connectionDocument.fhir_version || 'DSTU2';
  const fhirUrl =
    fhirVersion === 'R4' ? getR4Url(baseUrl) : getDSTU2Url(baseUrl);

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

  const defaultUrl = `${URLJoin(
    fhirUrl,
    fhirResourceUrl,
    `?${searchParams.toString()}`,
  )}`;
  const proxyUrl = URLJoin(
    Config.PUBLIC_URL,
    '/api/proxy',
    `?serviceId=${epicId}`,
    `&target=${encodeURIComponent(
      `${fhirResourceUrl}?${searchParams.toString()}`,
    )}&target_type=base`,
  );

  let allEntries: BundleEntry<T>[] = [];
  let nextUrl: string | undefined = useProxy ? proxyUrl : defaultUrl;

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
 * @param connectionDocument EpicConnectionDocument connection document
 * @param db RxDatabase to save to
 * @param fhirResourceUrl URL path FHIR resource to sync. e.g. Patient, Procedure, etc. Exclude the leading slash.
 * @param mapper Function to map the FHIR resource to a ClinicalDocument
 * @param params Query parameters to pass to the FHIR request
 * @returns
 */
async function syncFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params: Record<string, string | string[]>,
  useProxy = false,
) {
  const resc = await getFHIRResource<T>(
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
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params: Record<string, string | string[]>,
  includeMappers: Record<
    string,
    (entry: BundleEntry<any>) => CreateClinicalDocument<BundleEntry<any>>
  >,
  useProxy = false,
) {
  const resc = await getFHIRResource<T>(
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
  await db.clinical_documents.bulkUpsert(cds as unknown as ClinicalDocument[]);

  await processIncludedResources(resc, includeMappers, db, [fhirResourceUrl]);
}

/**
 * Sync all records from the FHIR server to the local database
 * @param baseUrl Base url of the FHIR server to sync from
 * @param connectionDocument
 * @param db
 * @param useProxy
 * @returns A promise of void arrays
 */
export async function syncAllRecords(
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false,
): Promise<PromiseSettledResult<void[]>[]> {
  const fhirVersion = connectionDocument.fhir_version || 'DSTU2';
  const mappers = fhirVersion === 'R4' ? R4 : DSTU2;

  const procMapper = (proc: BundleEntry<Procedure>) =>
    mappers.mapProcedureToClinicalDocument(proc as any, connectionDocument);
  const patientMapper = (pt: BundleEntry<Patient>) =>
    mappers.mapPatientToClinicalDocument(pt as any, connectionDocument);
  const obsMapper = (imm: BundleEntry<Observation>) =>
    mappers.mapObservationToClinicalDocument(imm as any, connectionDocument);
  const drMapper = (dr: BundleEntry<DiagnosticReport>) =>
    mappers.mapDiagnosticReportToClinicalDocument(dr as any, connectionDocument);
  const medStatementMapper = (dr: BundleEntry<MedicationStatement>) =>
    mappers.mapMedicationStatementToClinicalDocument(
      dr as any,
      connectionDocument,
    );
  const medRequestMapper = (mr: BundleEntry<MedicationRequest>) =>
    fhirVersion === 'R4'
      ? R4.mapMedicationRequestToClinicalDocument(mr as any, connectionDocument)
      : medStatementMapper(mr as any);
  const immMapper = (dr: BundleEntry<Immunization>) =>
    mappers.mapImmunizationToClinicalDocument(dr as any, connectionDocument);
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    mappers.mapConditionToClinicalDocument(dr as any, connectionDocument);
  const allergyIntoleranceMapper = (a: BundleEntry<AllergyIntolerance>) =>
    mappers.mapAllergyIntoleranceToClinicalDocument(a as any, connectionDocument);
  const carePlanMapper = (dr: BundleEntry<CarePlan>) =>
    mappers.mapCarePlanToClinicalDocument(dr as any, connectionDocument);
  const medDispenseMapper = (md: BundleEntry<MedicationDispense>) =>
    R4.mapMedicationDispenseToClinicalDocument(md as any, connectionDocument);
  const serviceRequestMapper = (sr: BundleEntry<ServiceRequest>) =>
    R4.mapServiceRequestToClinicalDocument(sr as any, connectionDocument);
  const goalMapper = (g: BundleEntry<Goal>) =>
    R4.mapGoalToClinicalDocument(g as any, connectionDocument);
  const careTeamMapper = (ct: BundleEntry<CareTeam>) =>
    R4.mapCareTeamToClinicalDocument(ct as any, connectionDocument);
  const coverageMapper = (c: BundleEntry<Coverage>) =>
    R4.mapCoverageToClinicalDocument(c as any, connectionDocument);
  const deviceMapper = (d: BundleEntry<Device>) =>
    R4.mapDeviceToClinicalDocument(d as any, connectionDocument);
  const encounterMapper = (e: BundleEntry<Encounter>) =>
    R4.mapEncounterToClinicalDocument(e as any, connectionDocument);
  const mediaMapper = (m: BundleEntry<Media>) =>
    R4.mapMediaToClinicalDocument(m as any, connectionDocument);
  const specimenMapper = (s: BundleEntry<Specimen>) =>
    R4.mapSpecimenToClinicalDocument(s as any, connectionDocument);
  const provenanceMapper = (p: BundleEntry<Provenance>) =>
    R4.mapProvenanceToClinicalDocument(p as any, connectionDocument);
  const relatedPersonMapper = (rp: BundleEntry<RelatedPerson>) =>
    R4.mapRelatedPersonToClinicalDocument(rp as any, connectionDocument);
  const locationMapper = (l: BundleEntry<FhirLocation>) =>
    R4.mapLocationToClinicalDocument(l as any, connectionDocument);
  const organizationMapper = (o: BundleEntry<Organization>) =>
    R4.mapOrganizationToClinicalDocument(o as any, connectionDocument);
  const practitionerRoleMapper = (pr: BundleEntry<PractitionerRole>) =>
    R4.mapPractitionerRoleToClinicalDocument(pr as any, connectionDocument);

  const includeMappers: Record<string, (entry: BundleEntry<any>) => any> = {
    Specimen: specimenMapper,
    Provenance: provenanceMapper,
    Location: locationMapper,
    Organization: organizationMapper,
    PractitionerRole: practitionerRoleMapper,
    RelatedPerson: relatedPersonMapper,
    Media: mediaMapper,
  };

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Procedure>(
      baseUrl,
      connectionDocument,
      db,
      'Procedure',
      procMapper as any,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
    ),
    syncFHIRResource<Patient>(
      baseUrl,
      connectionDocument,
      db,
      'Patient',
      patientMapper as any,
      {
        id: connectionDocument.patient,
      },
      useProxy,
    ),
    fhirVersion === 'R4'
      ? syncFHIRResourceWithIncludes<Observation>(
          baseUrl,
          connectionDocument,
          db,
          'Observation',
          obsMapper as any,
          {
            patient: connectionDocument.patient,
            category: 'laboratory',
            _include: ['Observation:specimen', 'Observation:derived-from'],
            _revinclude: 'Provenance:target',
          },
          includeMappers,
          useProxy,
        )
      : syncFHIRResource<Observation>(
          baseUrl,
          connectionDocument,
          db,
          'Observation',
          obsMapper as any,
          {
            patient: connectionDocument.patient,
            category: 'laboratory',
          },
          useProxy,
        ),
    fhirVersion === 'R4'
      ? syncFHIRResourceWithIncludes<DiagnosticReport>(
          baseUrl,
          connectionDocument,
          db,
          'DiagnosticReport',
          drMapper as any,
          {
            patient: connectionDocument.patient,
            _include: ['DiagnosticReport:specimen', 'DiagnosticReport:media'],
            _revinclude: 'Provenance:target',
          },
          includeMappers,
          useProxy,
        )
      : syncFHIRResource<DiagnosticReport>(
          baseUrl,
          connectionDocument,
          db,
          'DiagnosticReport',
          drMapper as any,
          {
            patient: connectionDocument.patient,
          },
          useProxy,
        ),
    fhirVersion === 'R4'
      ? syncFHIRResource<any>(
          baseUrl,
          connectionDocument,
          db,
          'MedicationRequest',
          medRequestMapper as any,
          {
            patient: connectionDocument.patient,
          },
          useProxy,
        )
      : syncFHIRResource<MedicationStatement>(
          baseUrl,
          connectionDocument,
          db,
          'MedicationStatement',
          medStatementMapper as any,
          {
            patient: connectionDocument.patient,
          },
          useProxy,
        ),
    syncFHIRResource<Immunization>(
      baseUrl,
      connectionDocument,
      db,
      'Immunization',
      immMapper as any,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
    ),
    syncFHIRResource<Condition>(
      baseUrl,
      connectionDocument,
      db,
      'Condition',
      conditionMapper as any,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
    ),
    syncFHIRResource<AllergyIntolerance>(
      baseUrl,
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper as any,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
    ),
    syncDocumentReferences(
      baseUrl,
      connectionDocument,
      db,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
    ),
    ...(fhirVersion === 'DSTU2'
      ? [
          syncFHIRResource<CarePlan>(
            baseUrl,
            connectionDocument,
            db,
            'CarePlan',
            carePlanMapper as any,
            {
              patient: connectionDocument.patient,
            },
            useProxy,
          ),
        ]
      : []),
    ...(fhirVersion === 'R4'
      ? [
          syncFHIRResourceWithIncludes<any>(
            baseUrl,
            connectionDocument,
            db,
            'MedicationDispense',
            medDispenseMapper as any,
            {
              patient: connectionDocument.patient,
              _revinclude: 'Provenance:target',
            },
            includeMappers,
            useProxy,
          ),
          syncFHIRResourceWithIncludes<any>(
            baseUrl,
            connectionDocument,
            db,
            'ServiceRequest',
            serviceRequestMapper as any,
            {
              patient: connectionDocument.patient,
              _include: 'ServiceRequest:specimen',
              _revinclude: 'Provenance:target',
            },
            includeMappers,
            useProxy,
          ),
          syncFHIRResourceWithIncludes<any>(
            baseUrl,
            connectionDocument,
            db,
            'Goal',
            goalMapper as any,
            {
              patient: connectionDocument.patient,
              _revinclude: 'Provenance:target',
            },
            includeMappers,
            useProxy,
          ),
          syncFHIRResourceWithIncludes<any>(
            baseUrl,
            connectionDocument,
            db,
            'CareTeam',
            careTeamMapper as any,
            {
              patient: connectionDocument.patient,
              _include: 'CareTeam:participant',
              _revinclude: 'Provenance:target',
            },
            includeMappers,
            useProxy,
          ),
          syncFHIRResourceWithIncludes<any>(
            baseUrl,
            connectionDocument,
            db,
            'Coverage',
            coverageMapper as any,
            {
              patient: connectionDocument.patient,
              _include: 'Coverage:payor',
              _revinclude: 'Provenance:target',
            },
            includeMappers,
            useProxy,
          ),
          syncFHIRResourceWithIncludes<any>(
            baseUrl,
            connectionDocument,
            db,
            'Device',
            deviceMapper as any,
            {
              patient: connectionDocument.patient,
              _revinclude: 'Provenance:target',
            },
            includeMappers,
            useProxy,
          ),
          syncFHIRResourceWithIncludes<any>(
            baseUrl,
            connectionDocument,
            db,
            'Encounter',
            encounterMapper as any,
            {
              patient: connectionDocument.patient,
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
        ]
      : []),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

async function syncDocumentReferences(
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
  useProxy = false,
) {
  const documentReferenceMapper = (dr: BundleEntry<DocumentReference>) =>
    DSTU2.mapDocumentReferenceToClinicalDocument(dr, connectionDocument);
  // Sync document references and return them
  await syncFHIRResource<DocumentReference>(
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    documentReferenceMapper,
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

  // format all the document references
  const docRefItems = docs.map(
    (doc) =>
      doc.toMutableJSON() as unknown as ClinicalDocument<
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
                  format: 'FHIR.DSTU2',
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

/**
 * Fetch attachment data from the FHIR server
 * @param url URL of the attachment
 * @param connectionDocument
 * @returns
 */
async function fetchAttachmentData(
  baseUrl: string,
  url: string,
  connectionDocument: EpicConnectionDocument,
  useProxy: boolean,
): Promise<{ contentType: string | null; raw: string | undefined }> {
  try {
    const epicId = connectionDocument.tenant_id;
    const defaultUrl = url;
    const proxyUrlExtension = url.replace(baseUrl, '');
    const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${epicId}&target=${`${encodeURIComponent(proxyUrlExtension)}&target_type=base`}`;
    const res = await fetch(useProxy ? proxyUrl : defaultUrl, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
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

    return { contentType, raw };
  } catch (e) {
    throw new Error(
      'Could not get document as the user is unauthorized. Try logging in again.',
    );
  }
}

/**
 * Using the code from the Epic callback, fetch the access token
 * @param code code from the Epic callback, usually a query param
 * @param epicTokenUrl url of the Epic server we are connecting to
 * @param epicName user friendly name of the Epic server we are connecting to
 * @returns Promise of the auth response from the Epic server
 */
export async function fetchAccessTokenWithCode(
  code: string,
  epicTokenUrl: string,
  epicName: string,
  epicId?: string,
  useProxy = false,
  version: 'DSTU2' | 'R4' = 'DSTU2',
): Promise<EpicAuthResponse> {
  const defaultUrl = epicTokenUrl;
  const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${`
  ${epicId}`}&target_type=token`;
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const isSandbox = isEpicSandbox(epicId);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getEpicClientId(version, isSandbox),
    redirect_uri: `${Config.PUBLIC_URL}${Routes.EpicCallback}`,
    code: code,
  });
  const res = await fetch(useProxy ? proxyUrl : defaultUrl, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) {
    console.error(await res.text());
    throw new Error('Error getting authorization token in ' + epicName);
  }
  return res.json();
}

export async function registerDynamicClient({
  res,
  epicBaseUrl,
  epicName,
  epicId,
  useProxy = false,
  version = 'DSTU2',
}: {
  res: EpicAuthResponse;
  epicBaseUrl: string;
  epicName: string;
  epicId?: string;
  useProxy?: boolean;
  version?: 'DSTU2' | 'R4';
}): Promise<EpicDynamicRegistrationResponse> {
  const baseUrl = epicBaseUrl
    .replace('/api/FHIR/DSTU2/', '')
    .replace('/api/FHIR/DSTU2', '')
    .replace('/api/FHIR/R4/', '')
    .replace('/api/FHIR/R4', '');
  const defaultUrl = URLJoin(baseUrl, '/oauth2/register');
  const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${epicId}&target_type=register`;

  const jsonWebKeySet = await getPublicKey();
  const validJWKS = jsonWebKeySet as JsonWebKeyWKid;
  const isSandbox = isEpicSandbox(epicId);
  const request: EpicDynamicRegistrationRequest = {
    software_id: getEpicClientId(version, isSandbox),
    jwks: {
      keys: [
        {
          e: validJWKS.e,
          kty: validJWKS.kty,
          n: validJWKS.n,
          kid: `${IDBKeyConfig.KEY_ID}`,
        },
      ],
    },
  };
  // We've got a temp access token and public key, now we can register this app as a dynamic client
  try {
    const registerRes = await fetch(useProxy ? proxyUrl : defaultUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${res.access_token}`,
      },
      body: JSON.stringify(request),
    });

    if (!registerRes.ok) {
      if (registerRes.status === 404) {
        throw new DynamicRegistrationError(
          'This site does not support dynamic client registration.',
          res,
        );
      }
      console.log(await registerRes.text());
      throw new Error('Error registering dynamic client with ' + epicName);
    }
    return await registerRes.json();
  } catch (e) {
    throw new DynamicRegistrationError(
      'This site does not support dynamic client registration.',
      res,
    );
  }
}

export class DynamicRegistrationError extends Error {
  public data: EpicAuthResponse;

  constructor(message: string, data: EpicAuthResponse) {
    super(message);
    this.name = 'DynamicRegistrationError';
    this.data = data;
  }
}

export async function fetchAccessTokenUsingJWT(
  clientId: string,
  epicTokenUrl: string,
  epicId?: string,
  useProxy = false,
): Promise<EpicAuthResponseWithClientId> {
  const defaultUrl = epicTokenUrl;
  const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${epicId}&target_type=token`;

  // We've registered, now we can get another access token with our signed JWT
  const jwtBody = {
    sub: clientId,
    iss: clientId,
    aud: epicTokenUrl,
    jti: uuid4(),
  };
  const signedJwt = await signJwt(jwtBody);
  const tokenRes = await fetch(useProxy ? proxyUrl : defaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      client_id: clientId,
      assertion: signedJwt,
    }),
  });
  if (!tokenRes.ok) {
    console.log(await tokenRes.text());
    throw new Error('Error getting access token');
  }
  const result = await tokenRes.json();
  return { ...result, client_id: clientId };
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
  const doc = await getConnectionCardByUrl<EpicConnectionDocument>(
    epicUrl,
    db,
    user.id,
  );
  // handle when epicUrl used to only have the base, but now has 'api/FHIR/DSTU2' appended, can remove this in the future
  // added on 12/29/2023
  const docLegacy = await getConnectionCardByUrl<EpicConnectionDocument>(
    (epicUrl.replace('/api/FHIR/DSTU2/', '') || '').replace(
      'api/FHIR/DSTU2',
      '',
    ),
    db,
    user.id,
  );
  return new Promise((resolve, reject) => {
    if (res?.access_token && res?.expires_in && res?.patient) {
      const currentDoc = doc || docLegacy;
      if (currentDoc) {
        // If we already have a connection card for this URL, update it
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
                tenant_id: epicId,
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
          tenant_id: epicId,
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
 * For a connection document, if the access token is expired, refresh it and save it to the db
 * @param connectionDocument the connection document to refresh the access token for
 * @param db
 */
export async function refreshEpicConnectionTokenIfNeeded(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false,
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_at') <= nowInSeconds) {
    try {
      const epicUrl = connectionDocument.get('location'),
        epicTokenUrl = connectionDocument.get('token_uri'),
        epicAuthUrl = connectionDocument.get('auth_uri'),
        epicName = connectionDocument.get('name'),
        clientId = connectionDocument.get('client_id'),
        epicId = connectionDocument.get('tenant_id'),
        userId = connectionDocument.get('user_id');

      // Fetch the actual UserDocument from the database
      const userObject = await findUserById(db, userId);

      if (!userObject) {
        throw new Error(`User not found: ${userId}`);
      }

      const access_token_data = await fetchAccessTokenUsingJWT(
        clientId,
        epicTokenUrl,
        epicId,
        useProxy,
      );

      return await saveConnectionToDb({
        res: access_token_data,
        epicBaseUrl: epicUrl,
        epicName,
        epicTokenUrl,
        epicAuthUrl,
        db,
        epicId,
        user: userObject,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token  - try logging in again');
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
