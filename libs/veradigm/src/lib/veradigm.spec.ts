import { VeradigmR4TenantEndpoints } from './veradigm';

describe('VeradigmR4TenantEndpoints', () => {
  it('contains the CP00101 sandbox tenant', () => {
    expect(VeradigmR4TenantEndpoints).toContainEqual({
      id: 'sandbox_veradigm',
      name: 'Veradigm Sandbox',
      url: 'https://fhir.fhirpoint.open.allscripts.com/fhirroute/open/CP00101/',
      token:
        'https://open.allscripts.com/fhirroute/patientauthv2/afdc1f7b-b362-4777-8ab3-83472abd0b8a/connect/token/',
      authorize:
        'https://open.allscripts.com/fhirroute/patientauthv2/afdc1f7b-b362-4777-8ab3-83472abd0b8a/connect/authorize/',
    });
  });
});
