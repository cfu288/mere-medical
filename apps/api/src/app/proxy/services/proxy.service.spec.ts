import { resolveProxyTarget } from './proxy.service';

const NORTHWELL_R4 = {
  id: '1a5fe784-078b-ef11-91a4-0050568bc890',
  name: 'Northwell Health',
  url: 'https://call.api.northwell.io/epic-proxy/api/fhir/R4/',
  token: 'https://call.api.northwell.io/epic-proxy/oauth2/token',
  authorize: 'https://call.api.northwell.io/epic-proxy/oauth2/authorize',
};

describe('resolveProxyTarget', () => {
  it('sends a base request to the tenant fhir url', () => {
    expect(resolveProxyTarget(NORTHWELL_R4, 'base')).toBe(
      'https://call.api.northwell.io/epic-proxy/api/fhir/R4/',
    );
  });

  it('sends an authorize request to the tenant authorize url', () => {
    expect(resolveProxyTarget(NORTHWELL_R4, 'authorize')).toBe(
      'https://call.api.northwell.io/epic-proxy/oauth2/authorize',
    );
  });

  it('sends a token request to the tenant token url', () => {
    expect(resolveProxyTarget(NORTHWELL_R4, 'token')).toBe(
      'https://call.api.northwell.io/epic-proxy/oauth2/token',
    );
  });

  it('sends a register request to the sibling of the authorize url', () => {
    expect(resolveProxyTarget(NORTHWELL_R4, 'register')).toBe(
      'https://call.api.northwell.io/epic-proxy/oauth2/register',
    );
  });

  it('registers against a path prefix that sits above the fhir base', () => {
    expect(
      resolveProxyTarget(
        {
          url: 'https://webprd.ochin.org/prd-fhir/MyChartAACI/api/FHIR/R4/',
          token: 'https://webprd.ochin.org/prd-fhir/MyChartAACI/oauth2/token',
          authorize:
            'https://webprd.ochin.org/prd-fhir/MyChartAACI/oauth2/authorize',
        },
        'register',
      ),
    ).toBe('https://webprd.ochin.org/prd-fhir/MyChartAACI/oauth2/register');
  });

  it('registers against a lowercase fhir path tenant', () => {
    expect(
      resolveProxyTarget(
        {
          url: 'https://prd.lluh.org/fhir/api/fhir/DSTU2/',
          token: 'https://prd.lluh.org/fhir/oauth2/token',
          authorize: 'https://prd.lluh.org/fhir/oauth2/authorize',
        },
        'register',
      ),
    ).toBe('https://prd.lluh.org/fhir/oauth2/register');
  });

  it('falls back to the fhir url for an unknown target type', () => {
    expect(resolveProxyTarget(NORTHWELL_R4, undefined)).toBe(
      'https://call.api.northwell.io/epic-proxy/api/fhir/R4/',
    );
  });
});
