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
import { concatPath } from '../../shared/utils/urlUtils';
import { signJwt } from '@mere/crypto/browser';
import type { JsonWebKeySet } from '@mere/crypto';
import {
  createEpicClient,
  createEpicClientWithProxy,
  EPIC_DEFAULT_SCOPES,
  type OAuthConfig,
  type EpicTokenSet,
} from '@mere/fhir-oauth';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../../models/clinical-document/ClinicalDocument.type';
import { findUserById } from '../../repositories/UserRepository';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';
import { upsertDocumentsIfConnectionValid } from '../../repositories/ClinicalDocumentRepository';

const epicClient = createEpicClient({ signJwt });

const createProxiedEpicClient = (publicUrl: string) =>
  createEpicClientWithProxy(
    { signJwt },
    (tenantId, targetType) =>
      `${publicUrl}/api/proxy?serviceId=${tenantId}&target_type=${targetType}`,
  );

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

async function getFHIRResource<T extends FhirResource>(
  config: AppConfig,
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string | string[]>,
  useProxy = false,
  signal?: AbortSignal,
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
    config.PUBLIC_URL || '',
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
      signal,
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
  config: AppConfig,
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params: Record<string, string | string[]>,
  useProxy = false,
  signal?: AbortSignal,
) {
  const resc = await getFHIRResource<T>(
    config,
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
    useProxy,
    signal,
  );

  const cds = resc
    .filter(
      (i) =>
        i.resource?.resourceType.toLowerCase() ===
        fhirResourceUrl.toLowerCase(),
    )
    .map(mapper);

  await upsertDocumentsIfConnectionValid(
    db,
    connectionDocument.user_id,
    connectionDocument.id,
    cds as unknown as ClinicalDocument[],
  );

  return cds;
}

async function processIncludedResources(
  entries: BundleEntry<any>[],
  mappers: Record<
    string,
    (entry: BundleEntry<any>) => CreateClinicalDocument<BundleEntry<any>>
  >,
  db: RxDatabase<DatabaseCollections>,
  connectionDocument: EpicConnectionDocument,
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
      await upsertDocumentsIfConnectionValid(
        db,
        connectionDocument.user_id,
        connectionDocument.id,
        cds as unknown as ClinicalDocument[],
      );
    }
  }
}

async function syncFHIRResourceWithIncludes<T extends FhirResource>(
  config: AppConfig,
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
  signal?: AbortSignal,
) {
  const resc = await getFHIRResource<T>(
    config,
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
    useProxy,
    signal,
  );

  const cds = resc
    .filter(
      (i) =>
        i.resource?.resourceType.toLowerCase() ===
        fhirResourceUrl.toLowerCase(),
    )
    .map(mapper);

  await upsertDocumentsIfConnectionValid(
    db,
    connectionDocument.user_id,
    connectionDocument.id,
    cds as unknown as ClinicalDocument[],
  );

  await processIncludedResources(resc, includeMappers, db, connectionDocument, [
    fhirResourceUrl,
  ]);
}

/**
 * Sync all records from the FHIR server to the local database
 * @param baseUrl Base url of the FHIR server to sync from
 * @param connectionDocument
 * @param db
 * @param useProxy
 * @param signal Optional abort signal to cancel the sync
 * @returns A promise of void arrays
 */
export async function syncAllRecords(
  config: AppConfig,
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false,
  signal?: AbortSignal,
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
    mappers.mapDiagnosticReportToClinicalDocument(
      dr as any,
      connectionDocument,
    );
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
    mappers.mapAllergyIntoleranceToClinicalDocument(
      a as any,
      connectionDocument,
    );
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
      config,
      baseUrl,
      connectionDocument,
      db,
      'Procedure',
      procMapper as any,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
      signal,
    ),
    syncFHIRResource<Patient>(
      config,
      baseUrl,
      connectionDocument,
      db,
      'Patient',
      patientMapper as any,
      {
        id: connectionDocument.patient,
      },
      useProxy,
      signal,
    ),
    fhirVersion === 'R4'
      ? syncFHIRResourceWithIncludes<Observation>(
          config,
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
          signal,
        )
      : syncFHIRResource<Observation>(
          config,
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
          signal,
        ),
    fhirVersion === 'R4'
      ? syncFHIRResourceWithIncludes<DiagnosticReport>(
          config,
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
          signal,
        )
      : syncFHIRResource<DiagnosticReport>(
          config,
          baseUrl,
          connectionDocument,
          db,
          'DiagnosticReport',
          drMapper as any,
          {
            patient: connectionDocument.patient,
          },
          useProxy,
          signal,
        ),
    fhirVersion === 'R4'
      ? syncFHIRResource<any>(
          config,
          baseUrl,
          connectionDocument,
          db,
          'MedicationRequest',
          medRequestMapper as any,
          {
            patient: connectionDocument.patient,
          },
          useProxy,
          signal,
        )
      : syncFHIRResource<MedicationStatement>(
          config,
          baseUrl,
          connectionDocument,
          db,
          'MedicationStatement',
          medStatementMapper as any,
          {
            patient: connectionDocument.patient,
          },
          useProxy,
          signal,
        ),
    syncFHIRResource<Immunization>(
      config,
      baseUrl,
      connectionDocument,
      db,
      'Immunization',
      immMapper as any,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
      signal,
    ),
    syncFHIRResource<Condition>(
      config,
      baseUrl,
      connectionDocument,
      db,
      'Condition',
      conditionMapper as any,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
      signal,
    ),
    syncFHIRResource<AllergyIntolerance>(
      config,
      baseUrl,
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper as any,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
      signal,
    ),
    syncDocumentReferences(
      config,
      baseUrl,
      connectionDocument,
      db,
      {
        patient: connectionDocument.patient,
      },
      useProxy,
      fhirVersion,
      signal,
    ),
    ...(fhirVersion === 'DSTU2'
      ? [
          syncFHIRResource<CarePlan>(
            config,
            baseUrl,
            connectionDocument,
            db,
            'CarePlan',
            carePlanMapper as any,
            {
              patient: connectionDocument.patient,
            },
            useProxy,
            signal,
          ),
        ]
      : []),
    ...(fhirVersion === 'R4'
      ? [
          syncFHIRResourceWithIncludes<any>(
            config,
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
            signal,
          ),
          syncFHIRResourceWithIncludes<any>(
            config,
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
            signal,
          ),
          syncFHIRResourceWithIncludes<any>(
            config,
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
            signal,
          ),
          syncFHIRResourceWithIncludes<any>(
            config,
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
            signal,
          ),
          syncFHIRResourceWithIncludes<any>(
            config,
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
            signal,
          ),
          syncFHIRResourceWithIncludes<any>(
            config,
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
            signal,
          ),
          syncFHIRResourceWithIncludes<any>(
            config,
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
            signal,
          ),
        ]
      : []),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

async function syncDocumentReferences(
  config: AppConfig,
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
  useProxy = false,
  fhirVersion: 'DSTU2' | 'R4' = 'DSTU2',
  signal?: AbortSignal,
) {
  const documentReferenceMapper = (dr: BundleEntry<DocumentReference>) =>
    fhirVersion === 'R4'
      ? R4.mapDocumentReferenceToClinicalDocument(dr as any, connectionDocument)
      : DSTU2.mapDocumentReferenceToClinicalDocument(dr, connectionDocument);
  await syncFHIRResource<any>(
    config,
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    documentReferenceMapper as any,
    params,
    useProxy,
    signal,
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
            const { contentType, raw } = await fetchAttachmentData(
              config,
              baseUrl,
              attachmentUrl,
              connectionDocument,
              useProxy,
              signal,
            );
            if (raw && contentType) {
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
                  date:
                    docRefItem.data_record.raw.resource?.created ||
                    docRefItem.data_record.raw.resource?.context?.period?.start,
                  display_name:
                    docRefItem.data_record.raw.resource?.type?.text ||
                    docRefItem.metadata?.display_name,
                },
              };

              await upsertDocumentsIfConnectionValid(
                db,
                connectionDocument.user_id,
                connectionDocument.id,
                [cd as unknown as ClinicalDocument],
              );
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
  signal?: AbortSignal,
): Promise<{ contentType: string | null; raw: string | undefined }> {
  try {
    const epicId = connectionDocument.tenant_id;
    const isRelativeUrl =
      !url.startsWith('http://') && !url.startsWith('https://');
    const fullUrl = isRelativeUrl ? concatPath(baseUrl, url) : url;
    const defaultUrl = fullUrl;
    const proxyUrlExtension = fullUrl.replace(baseUrl, '');
    const proxyUrl = `${config.PUBLIC_URL || ''}/api/proxy?serviceId=${epicId}&target=${`${encodeURIComponent(proxyUrlExtension)}&target_type=base`}`;
    const fetchUrl = useProxy ? proxyUrl : defaultUrl;
    const res = await fetch(fetchUrl, {
      signal,
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
      },
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

      const oauthConfig: OAuthConfig = {
        clientId: getEpicClientId(config, fhirVersion, isEpicSandbox(epicId)),
        redirectUri: `${config.PUBLIC_URL}${Routes.EpicCallback}`,
        scopes: ['openid', 'fhirUser'],
        tenant: {
          id: epicId,
          name: epicName,
          authUrl: epicAuthUrl,
          tokenUrl: epicTokenUrl,
          fhirBaseUrl: epicUrl,
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
