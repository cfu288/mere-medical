import { upsertEntries, upsertIncludedEntries } from './upsert';

function createDatabase() {
  return {
    clinical_documents: {
      bulkUpsert: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe('upsertEntries', () => {
  it('maps entries with the requested resource type', async () => {
    const db = createDatabase();
    const connection = { id: 'connection-1' };
    const procedure = { resource: { resourceType: 'Procedure', id: 'p1' } };
    const patient = { resource: { resourceType: 'Patient', id: 'pt1' } };
    const mapper = jest.fn().mockReturnValue({ id: 'mapped-procedure' });

    await upsertEntries(
      db,
      [procedure, patient],
      'Procedure',
      mapper,
      connection,
    );

    expect(mapper).toHaveBeenCalledTimes(1);
    expect(mapper).toHaveBeenCalledWith(procedure, connection);
    expect(mapper).not.toHaveBeenCalledWith(procedure, 0);
    expect(db.clinical_documents.bulkUpsert).toHaveBeenCalledWith([
      { id: 'mapped-procedure' },
    ]);
  });
});

describe('upsertIncludedEntries', () => {
  it('groups each included resource type and passes the connection', async () => {
    const db = createDatabase();
    const connection = { id: 'connection-1' };
    const specimenOne = {
      resource: { resourceType: 'Specimen', id: 'specimen-1' },
    };
    const specimenTwo = {
      resource: { resourceType: 'Specimen', id: 'specimen-2' },
    };
    const provenance = {
      resource: { resourceType: 'Provenance', id: 'provenance-1' },
    };
    const specimenMapper = jest
      .fn()
      .mockReturnValueOnce({ id: 'mapped-specimen-1' })
      .mockReturnValueOnce({ id: 'mapped-specimen-2' });
    const provenanceMapper = jest
      .fn()
      .mockReturnValue({ id: 'mapped-provenance' });

    await upsertIncludedEntries(
      db,
      [specimenOne, provenance, specimenTwo],
      { Specimen: specimenMapper, Provenance: provenanceMapper },
      connection,
      'DiagnosticReport',
    );

    expect(specimenMapper).toHaveBeenNthCalledWith(1, specimenOne, connection);
    expect(specimenMapper).toHaveBeenNthCalledWith(2, specimenTwo, connection);
    expect(provenanceMapper).toHaveBeenCalledWith(provenance, connection);
    expect(db.clinical_documents.bulkUpsert).toHaveBeenNthCalledWith(1, [
      { id: 'mapped-specimen-1' },
      { id: 'mapped-specimen-2' },
    ]);
    expect(db.clinical_documents.bulkUpsert).toHaveBeenNthCalledWith(2, [
      { id: 'mapped-provenance' },
    ]);
  });

  it('skips the searched resource type and types with no mapper', async () => {
    const db = createDatabase();
    const connection = { id: 'connection-1' };
    const diagnosticReport = {
      resource: { resourceType: 'DiagnosticReport', id: 'report-1' },
    };
    const media = { resource: { resourceType: 'Media', id: 'media-1' } };
    const diagnosticReportMapper = jest
      .fn()
      .mockReturnValue({ id: 'mapped-report' });

    await upsertIncludedEntries(
      db,
      [diagnosticReport, media, {}],
      { DiagnosticReport: diagnosticReportMapper },
      connection,
      'DiagnosticReport',
    );

    expect(diagnosticReportMapper).not.toHaveBeenCalled();
    expect(db.clinical_documents.bulkUpsert).not.toHaveBeenCalled();
  });
});
