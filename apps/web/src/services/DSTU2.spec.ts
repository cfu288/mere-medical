import * as DSTU2 from './DSTU2';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';
import { BundleEntry, Procedure } from 'fhir/r2';

describe('DSTU2', () => {
  it('should map FHIR procedure to clinical document', () => {
    const mockDSTU2Procedure: BundleEntry<Procedure> = {
      resource: {
        status: 'completed',
        performedDateTime: '2022-03-30T15:30:00-04:00',
        code: {
          text: 'IMMUNIZATION ADMIN',
          coding: [
            {
              code: '90471',
              system:
                'https://www.ama-assn.org/practice-management/cpt-current-procedural-terminology',
              display: 'IMMUNIZATION ADMIN',
            },
          ],
        },
        resourceType: 'Procedure',
        id: '226089201',
        subject: {
          reference: 'Patient/1850092',
        },
      },
      fullUrl: ['/api/fhir/Procedure/226089201'],
    };

    const mockConnectionDocument: Pick<ConnectionDocument, 'user_id' | 'id'> = {
      user_id: '123',
      id: '456',
    };

    const res = DSTU2.mapProcedureToClinicalDocument(
      mockDSTU2Procedure,
      mockConnectionDocument,
    );

    expect(res.user_id).toBe('123');
    expect(res.connection_record_id).toBe('456');

    expect(res.data_record.content_type).toBe('application/json');
    expect(res.data_record.resource_type).toBe('procedure');
    expect(res.data_record.format).toBe('FHIR.DSTU2');
    expect(res.data_record.raw).toBe(mockDSTU2Procedure);

    expect(res.metadata?.id).toBe('Procedure/226089201');
    expect(res.metadata?.date).toBe('2022-03-30T15:30:00-04:00');
    expect(res.metadata?.display_name).toBe('IMMUNIZATION ADMIN');
  });
});
