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
} from 'fhir/r2';
import { environment } from '../environments/environment';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { OnPatientAuthResponse } from '../pages/OnPatientRedirect';
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

  export async function getAccessTokenFromRefreshToken(
    refreshToken: string
  ): Promise<OnPatientAuthResponse> {
    const params = {
      grant_type: 'refresh_token',
      client_id: 'a1xHQJ2nqn4NjtIJqaGCRezsL7EqxddvJd3NrqcK',
      client_secret:
        'vsWuUM3ioU06Pd737fPoAWhkV5aBlU8PK7XFJ5AeOrhMSlc8UnoEnNqnFYfesj98eZjnZITxx9Aos7XFHuU9BoFXBbaSXJ3J93gMrT9qtyTHIVDwY5yIMTj2EkPCFXwC',
      redirect_uri: 'https://localhost:3000/tab2',
      refresh_token: refreshToken,
    };
    const encodedParams = new URLSearchParams(params as Record<string, string>);
    const url = `https://onpatient.com/o/token/?${encodedParams}`;

    return await fetch(url, {
      method: 'POST',
    })
      .then((res) => res.json())
      .then((codeRes: OnPatientAuthResponse) => codeRes);
  }

  async function getProcedures(
    connectionDocument: ConnectionDocument
  ): Promise<BundleEntry<Procedure>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Procedure`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
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
    connectionDocument: ConnectionDocument
  ): Promise<BundleEntry<Immunization>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Immunization`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
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
    connectionDocument: ConnectionDocument
  ): Promise<BundleEntry<Condition>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Condition`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
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
    connectionDocument: ConnectionDocument
  ): Promise<BundleEntry<Observation>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Observation`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
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
    connectionDocument: ConnectionDocument
  ): Promise<BundleEntry<DiagnosticReport>[]> {
    const res = await fetch(`https://onpatient.com/api/fhir/Observation`, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
      },
    })
      .then((res) => res.json())
      .then((res: Bundle) => res);

    if (res.entry) {
      return res.entry as BundleEntry<DiagnosticReport>[];
    }
    return [];
  }

  async function syncDiagnosticReport(
    connectionDocument: ConnectionDocument,
    db: PouchDB.Database<{}>
  ) {
    const drs = await getDiagnosticReport(connectionDocument);
    const cds = drs.map((dr) =>
      DSTU2.mapDiagnosticReportToCreateClinicalDocument(dr, connectionDocument)
    );
    const cdsmap = cds.map(async (cd) => {
      const exists = await db.find({
        selector: {
          $and: [
            { 'metadata.id': `${cd.metadata?.id}` },
            { source_record: `${cd.source_record}` },
          ],
        },
      });
      if (exists.docs.length > 0) {
        console.log(`Skipped record ${cd._id}`);
      } else {
        await db.put(cd);
        console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  async function syncObservations(
    connectionDocument: ConnectionDocument,
    db: PouchDB.Database<{}>
  ) {
    const imms = await getObservations(connectionDocument);
    const cds = imms.map((imm) =>
      DSTU2.mapObservationToCreateClinicalDocument(imm, connectionDocument)
    );
    const cdsmap = cds.map(async (cd) => {
      const exists = await db.find({
        selector: {
          $and: [
            { 'metadata.id': `${cd.metadata?.id}` },

            { source_record: `${cd.source_record}` },
          ],
        },
      });
      if (exists.docs.length > 0) {
        console.log(`Skipped record ${cd._id}`);
      } else {
        await db.put(cd);
        console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  async function syncImmunizations(
    connectionDocument: ConnectionDocument,
    db: PouchDB.Database<{}>
  ) {
    const imms = await getImmunizations(connectionDocument);
    const cds = imms.map((imm) =>
      DSTU2.mapImmunizationToCreateClinicalDocument(imm, connectionDocument)
    );
    const cdsmap = cds.map(async (cd) => {
      const exists = await db.find({
        selector: {
          $and: [
            { 'metadata.id': `${cd.metadata?.id}` },
            { source_record: `${cd.source_record}` },
          ],
        },
      });
      if (exists.docs.length > 0) {
        console.log(`Skipped record ${cd._id}`);
      } else {
        await db.put(cd);
        console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  async function syncProcedures(
    connectionDocument: ConnectionDocument,
    db: PouchDB.Database<{}>
  ) {
    const procs = await getProcedures(connectionDocument);
    const cds = procs.map((proc) =>
      DSTU2.mapProcedureToCreateClinicalDocument(proc, connectionDocument)
    );
    const cdsmap = cds.map(async (cd) => {
      const exists = await db.find({
        selector: {
          $and: [
            { 'metadata.id': `${cd.metadata?.id}` },
            { source_record: `${cd.source_record}` },
          ],
        },
      });
      if (exists.docs.length > 0) {
        console.log(`Skipped record ${cd._id}`);
      } else {
        await db.put(cd);
        console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  async function syncConditions(
    connectionDocument: ConnectionDocument,
    db: PouchDB.Database<{}>
  ) {
    const procs = await getConditions(connectionDocument);
    const cds = procs.map((proc) =>
      DSTU2.mapConditionToCreateClinicalDocument(proc, connectionDocument)
    );
    const cdsmap = cds.map(async (cd) => {
      const exists = await db.find({
        selector: {
          $and: [
            { 'metadata.id': `${cd.metadata?.id}` },
            { source_record: `${cd.source_record}` },
          ],
        },
      });
      if (exists.docs.length > 0) {
        console.log(`Skipped record ${cd._id}`);
      } else {
        await db.put(cd);
        console.log(`Saved record ${cd._id}`);
      }
    });
    return await Promise.all(cdsmap);
  }

  export async function syncAllRecords(
    connectionDocument: ConnectionDocument,
    db: PouchDB.Database<{}>
  ): Promise<(void | void[])[]> {
    const newCd = connectionDocument;
    newCd.last_refreshed = new Date().toISOString();
    await db.put(newCd);
    const syncJob = Promise.all([
      syncImmunizations(connectionDocument, db),
      syncProcedures(connectionDocument, db),
      syncConditions(connectionDocument, db),
      syncObservations(connectionDocument, db),
      syncDiagnosticReport(connectionDocument, db),
    ]);

    return syncJob;
  }
}
