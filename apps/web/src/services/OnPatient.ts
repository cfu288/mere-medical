/* eslint-disable no-inner-declarations */
/* eslint-disable @typescript-eslint/no-namespace */
import {
  Bundle,
  BundleEntry,
  Procedure,
  Immunization,
  Condition,
  Observation,
  DiagnosticReport,
  MedicationStatement,
  Patient,
} from 'fhir/r2';
import { RxDatabase, RxDocument } from 'rxdb';
import { DatabaseCollections } from '../components/RxDbProvider';
import { environment } from '../environments/environment';
import { ClinicalDocumentType } from '../models/ClinicalDocumentCollection';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { DSTU2 } from './DSTU2';

export namespace OnPatient {
  export function getLoginUrl() {
    return `https://onpatient.com/o/authorize/?${new URLSearchParams({
      client_id: environment.onpatient_client_id,
      redirect_uri: environment.redirect_uri,
      scope: 'patient/*.read',
      response_type: 'code',
    })}`;
  }

  // export async function getAccessTokenFromRefreshToken(
  //   refreshToken: string
  // ): Promise<OnPatientAuthResponse> {
  //   const params = {
  //     grant_type: 'refresh_token',
  //     client_id: environment.onpatient_client_id,
  //     client_secret: environment.onpatient_client_secret,
  //     redirect_uri: 'https://localhost:3000/tab2',
  //     refresh_token: refreshToken,
  //   };
  //   const encodedParams = new URLSearchParams(params as Record<string, string>);
  //   const url = `https://onpatient.com/o/token/?${encodedParams}`;

  //   return await fetch(url, {
  //     method: 'POST',
  //   })
  //     .then((res) => res.json())
  //     .then((codeRes: OnPatientAuthResponse) => codeRes);
  // }

  async function getProcedures(
    connectionDocument: RxDocument<ConnectionDocument>
  ): Promise<BundleEntry<Procedure>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Procedure`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.get('access_token')}`,
      },
    })
      .then((res) => res.json())
      .then((res: Bundle) => res);

    if (res.entry) {
      return res.entry as BundleEntry<Procedure>[];
    }
    return [];
  }

  async function getImmunizations(
    connectionDocument: RxDocument<ConnectionDocument>
  ): Promise<BundleEntry<Immunization>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Immunization`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.get('access_token')}`,
      },
    })
      .then((res) => res.json())
      .then((res: Bundle) => res);

    if (res.entry) {
      return res.entry as BundleEntry<Immunization>[];
    }
    return [];
  }

  async function getConditions(
    connectionDocument: RxDocument<ConnectionDocument>
  ): Promise<BundleEntry<Condition>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Condition`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.get('access_token')}`,
      },
    })
      .then((res) => res.json())
      .then((res: Bundle) => res);

    if (res.entry) {
      return res.entry as BundleEntry<Condition>[];
    }
    return [];
  }

  async function getObservations(
    connectionDocument: RxDocument<ConnectionDocument>
  ): Promise<BundleEntry<Observation>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Observation`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.get('access_token')}`,
      },
    })
      .then((res) => res.json())
      .then((res: Bundle) => res);

    if (res.entry) {
      return res.entry as BundleEntry<Observation>[];
    }
    return [];
  }

  async function getDiagnosticReport(
    connectionDocument: RxDocument<ConnectionDocument>
  ): Promise<BundleEntry<DiagnosticReport>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Observation`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.get('access_token')}`,
      },
    })
      .then((res) => res.json())
      .then((res: Bundle) => res);

    if (res.entry) {
      return res.entry as BundleEntry<DiagnosticReport>[];
    }
    return [];
  }

  async function getMedicationStatements(
    connectionDocument: RxDocument<ConnectionDocument>
  ): Promise<BundleEntry<MedicationStatement>[]> {
    const res = await fetch(
      `https://onpatient.com/api/fhir/MedicationStatement`,
      {
        headers: {
          Authorization: `Bearer ${connectionDocument.get('access_token')}`,
        },
      }
    )
      .then((res) => res.json())
      .then((res: Bundle) => res);

    if (res.entry) {
      return res.entry as BundleEntry<MedicationStatement>[];
    }
    return [];
  }

  async function getPatients(
    connectionDocument: RxDocument<ConnectionDocument>
  ): Promise<BundleEntry<Patient>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Patient`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.get('access_token')}`,
      },
    })
      .then((res) => res.json())
      .then((res: Bundle) => res);

    if (res.entry) {
      return res.entry as BundleEntry<Patient>[];
    }
    return [];
  }

  async function syncPatients(
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ) {
    const pts = await getPatients(connectionDocument);
    const uds = pts.map((pt) =>
      DSTU2.mapPatientToCreateClinicalDocument(pt, connectionDocument)
    );
    const udsmap = uds.map(async (cd) => {
      const exists = await db.user_documents
        .findOne({
          selector: {
            $and: [
              { 'metadata.id': `${cd.metadata?.id}` },
              { source_record: `${cd.source_record}` },
            ],
          },
        })
        .exec();

      if (exists) {
        // console.log(`Skipped record ${cd._id}`);
      } else {
        await db.user_documents.insert(cd as ClinicalDocumentType);
        // console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(udsmap);
  }

  async function syncDiagnosticReport(
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ) {
    const drs = await getDiagnosticReport(connectionDocument);
    const cds = drs.map((dr) =>
      DSTU2.mapDiagnosticReportToCreateClinicalDocument(
        dr,
        connectionDocument.toJSON()
      )
    );
    const cdsmap = cds.map(async (cd) => {
      const exists = await db.clinical_documents
        .findOne({
          selector: {
            $and: [
              { 'metadata.id': `${cd.metadata?.id}` },
              { source_record: `${cd.source_record}` },
            ],
          },
        })
        .exec();

      if (exists) {
        // console.log(`Skipped record ${cd._id}`);
      } else {
        await db.clinical_documents.insert(cd as ClinicalDocumentType);
        // console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  async function syncObservations(
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ) {
    const imms = await getObservations(connectionDocument);
    const cds = imms.map((imm) =>
      DSTU2.mapObservationToCreateClinicalDocument(
        imm,
        connectionDocument.toJSON()
      )
    );
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
      if (exists.length > 0) {
        // console.log(`Skipped record ${cd._id}`);
      } else {
        await db.clinical_documents.insert(cd as ClinicalDocumentType);
        // console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  async function syncImmunizations(
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ) {
    const imms = await getImmunizations(connectionDocument);
    const cds = imms.map((imm) =>
      DSTU2.mapImmunizationToCreateClinicalDocument(
        imm,
        connectionDocument.toJSON()
      )
    );
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
      if (exists.length > 0) {
        // console.log(`Skipped record ${cd._id}`);
      } else {
        await db.clinical_documents.insert(cd as ClinicalDocumentType);
        // console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  async function syncProcedures(
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ) {
    const procs = await getProcedures(connectionDocument);
    const cds = procs.map((proc) =>
      DSTU2.mapProcedureToCreateClinicalDocument(
        proc,
        connectionDocument.toJSON()
      )
    );
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
      if (exists.length > 0) {
        // console.log(`Skipped record ${cd._id}`);
      } else {
        await db.clinical_documents.insert(cd as ClinicalDocumentType);
        // console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  async function syncConditions(
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ) {
    const procs = await getConditions(connectionDocument);
    const cds = procs.map((proc) =>
      DSTU2.mapConditionToCreateClinicalDocument(
        proc,
        connectionDocument.toJSON()
      )
    );
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
      if (exists.length > 0) {
        // console.log(`Skipped record ${cd._id}`);
      } else {
        await db.clinical_documents.insert(cd as ClinicalDocumentType);
        // console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  async function syncMedicationStatements(
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ) {
    const medStmts = await getMedicationStatements(connectionDocument);
    const cds = medStmts.map((mdst) =>
      DSTU2.mapMedicationStatementToCreateClinicalDocument(
        mdst,
        connectionDocument.toJSON()
      )
    );
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
      if (exists.length > 0) {
        // console.log(`Skipped record ${cd._id}`);
      } else {
        await db.clinical_documents.insert(cd as ClinicalDocumentType);
        // console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  export async function syncAllRecords(
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ): Promise<any[][]> {
    const newCd = connectionDocument.toMutableJSON();
    newCd.last_refreshed = new Date().toISOString();
    const syncJob = await Promise.all([
      syncImmunizations(connectionDocument, db),
      syncProcedures(connectionDocument, db),
      syncConditions(connectionDocument, db),
      syncObservations(connectionDocument, db),
      syncDiagnosticReport(connectionDocument, db),
      syncMedicationStatements(connectionDocument, db),
      syncPatients(connectionDocument, db),
      db.connection_documents.upsert(newCd).then(() => []),
    ]);

    return syncJob;
  }
}
