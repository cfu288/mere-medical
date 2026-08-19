import { mapSearchedResources, mapCompanionResources } from './mapResources';

describe('mapSearchedResources', () => {
  it('maps only entries with the requested resource type', () => {
    const connection = { id: 'connection-1' };
    const procedure = { resource: { resourceType: 'Procedure', id: 'p1' } };
    const patient = { resource: { resourceType: 'Patient', id: 'pt1' } };
    const mapper = jest.fn().mockReturnValue({ id: 'mapped-procedure' });

    const documents = mapSearchedResources(
      [procedure, patient],
      'Procedure',
      mapper,
      connection,
    );

    expect(documents).toEqual([{ id: 'mapped-procedure' }]);
    expect(mapper).toHaveBeenCalledTimes(1);
    expect(mapper).toHaveBeenCalledWith(procedure, connection);
    expect(mapper).not.toHaveBeenCalledWith(procedure, 0);
  });
});

describe('mapCompanionResources', () => {
  it('maps each included resource type with the connection', () => {
    const connection = { id: 'connection-1' };
    const specimen = { resource: { resourceType: 'Specimen', id: 's1' } };
    const provenance = { resource: { resourceType: 'Provenance', id: 'pr1' } };
    const specimenMapper = jest.fn().mockReturnValue({ id: 'mapped-specimen' });
    const provenanceMapper = jest
      .fn()
      .mockReturnValue({ id: 'mapped-provenance' });

    const documents = mapCompanionResources(
      [specimen, provenance],
      { Specimen: specimenMapper, Provenance: provenanceMapper },
      connection,
      'DiagnosticReport',
    );

    expect(documents).toEqual([
      { id: 'mapped-specimen' },
      { id: 'mapped-provenance' },
    ]);
    expect(specimenMapper).toHaveBeenCalledWith(specimen, connection);
    expect(provenanceMapper).toHaveBeenCalledWith(provenance, connection);
  });

  it('skips the searched resource type and types with no mapper', () => {
    const connection = { id: 'connection-1' };
    const diagnosticReport = {
      resource: { resourceType: 'DiagnosticReport', id: 'r1' },
    };
    const media = { resource: { resourceType: 'Media', id: 'm1' } };
    const diagnosticReportMapper = jest
      .fn()
      .mockReturnValue({ id: 'mapped-report' });

    const documents = mapCompanionResources(
      [diagnosticReport, media, {}],
      { DiagnosticReport: diagnosticReportMapper },
      connection,
      'DiagnosticReport',
    );

    expect(documents).toEqual([]);
    expect(diagnosticReportMapper).not.toHaveBeenCalled();
  });
});
