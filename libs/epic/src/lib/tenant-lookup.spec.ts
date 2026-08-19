import {
  EpicDSTU2TenantEndpoints,
  EpicR4TenantEndpoints,
} from './epic';
import { findEpicTenantById, getEpicRegistrationUrl } from './tenant-lookup';

const NORTHWELL_R4_ID = '1a5fe784-078b-ef11-91a4-0050568bc890';
const VIVO_PHARMACY_R4_ID = 'c6e5f01b-a2ca-48a1-8949-c1ccf4dd254e';
const LOMA_LINDA_DSTU2_ID = '989e0f4c-9813-e911-9126-001dd8b71f19';
const OCHIN_AACI_R4_ID = '2baa00f4-3236-f011-91f0-0050568bc890';
const UCSF_HEALTH_DSTU2_ID = 'cc9e0f4c-9813-e911-9126-001dd8b71f19';
const UCSF_BENIOFF_DSTU2_ID = 'cd9e0f4c-9813-e911-9126-001dd8b71f19';
const ALLINA_R4_ID = '4e46681c-9317-48bd-91a6-628600d00ba5';
const CUYUNA_R4_ID = 'deceab52-2c3e-4726-b0e2-f9361f507d29';
const UCHICAGO_DSTU2_ID = '7c9c0f4c-9813-e911-9126-001dd8b71f19';
const KAISER_NORTHWEST_R4_ID = '7265770b-0a31-ec11-9155-001dd8b71f19';
const FROEDTERT_DSTU2_ID = 'f39c0f4c-9813-e911-9126-001dd8b71f19';
const DREXEL_DSTU2_ID = '2207be8e-a412-ed11-9156-001dd8b71f1a';
const MY_DR_NOW_DSTU2_ID = '3d637ae5-a412-ed11-9156-001dd8b71f1a';
const MY_DR_NOW_R4_ID = '43107f24-aaef-4140-946f-d6e0d0112231';
const KELSEY_SEYBOLD_DSTU2_ID = '7dfd5c4f-d47d-ea11-912c-001dd8b71f1a';
const SANDBOX_DSTU2_ID = 'sandbox_epic';
const SANDBOX_R4_ID = 'sandbox_epic_r4';

describe('findEpicTenantById', () => {
  it('returns the tenant url verbatim, including a lowercase fhir path segment', () => {
    expect(findEpicTenantById(NORTHWELL_R4_ID)?.url).toBe(
      'https://call.api.northwell.io/epic-proxy/api/fhir/R4/',
    );
  });

  it('distinguishes two tenants whose urls differ only by case', () => {
    expect(findEpicTenantById(NORTHWELL_R4_ID)?.name).toBe('Northwell Health');
    expect(findEpicTenantById(VIVO_PHARMACY_R4_ID)?.name).toBe(
      'Vivo Pharmacy',
    );
    expect(findEpicTenantById(VIVO_PHARMACY_R4_ID)?.url).toBe(
      'https://call.api.northwell.io/epic-proxy/api/FHIR/R4/',
    );
  });

  it('finds DSTU2 tenants', () => {
    expect(findEpicTenantById(LOMA_LINDA_DSTU2_ID)?.url).toBe(
      'https://prd.lluh.org/fhir/api/fhir/DSTU2/',
    );
  });

  it('distinguishes two DSTU2 tenants that share one fhir base url', () => {
    expect(findEpicTenantById(UCSF_HEALTH_DSTU2_ID)?.name).toBe('UCSF Health');
    expect(findEpicTenantById(UCSF_BENIOFF_DSTU2_ID)?.name).toBe(
      "UCSF Benioff Children's Hospital",
    );
    expect(findEpicTenantById(UCSF_HEALTH_DSTU2_ID)?.url).toBe(
      findEpicTenantById(UCSF_BENIOFF_DSTU2_ID)?.url,
    );
  });

  it('distinguishes two R4 tenants that share one fhir base url', () => {
    expect(findEpicTenantById(ALLINA_R4_ID)?.name).toBe('Allina');
    expect(findEpicTenantById(CUYUNA_R4_ID)?.name).toBe(
      'Cuyuna Regional Medical Center',
    );
    expect(findEpicTenantById(ALLINA_R4_ID)?.url).toBe(
      findEpicTenantById(CUYUNA_R4_ID)?.url,
    );
  });

  it('distinguishes tenants in the largest shared-url cluster', () => {
    expect(findEpicTenantById(DREXEL_DSTU2_ID)?.name).toBe('Drexel Medicine');
    expect(findEpicTenantById(MY_DR_NOW_DSTU2_ID)?.name).toBe('MY DR NOW');
    expect(findEpicTenantById(DREXEL_DSTU2_ID)?.url).toBe(
      'https://epicproxy.et4001.epichosted.com/FHIRProxy/api/FHIR/DSTU2/',
    );
    expect(findEpicTenantById(MY_DR_NOW_DSTU2_ID)?.url).toBe(
      'https://epicproxy.et4001.epichosted.com/FHIRProxy/api/FHIR/DSTU2/',
    );
  });

  it('distinguishes two tenants that share a name across versions', () => {
    expect(findEpicTenantById(MY_DR_NOW_R4_ID)?.name).toBe('MY DR NOW');
    expect(findEpicTenantById(MY_DR_NOW_R4_ID)?.url).toBe(
      'https://epicproxy.et4001.epichosted.com/APIProxyPRD/MDN/api/FHIR/R4/',
    );
  });

  it('keeps an uppercase hostname verbatim', () => {
    expect(findEpicTenantById(KAISER_NORTHWEST_R4_ID)?.url).toBe(
      'https://FHIR.KP.ORG/service/ptnt_care/EpicEdiFhirRoutingSvc/v2014/esb-envlbl/190/api/FHIR/R4/',
    );
  });

  it('returns undefined for an unknown id', () => {
    expect(findEpicTenantById('not-a-tenant')).toBeUndefined();
  });
});

describe('getEpicRegistrationUrl', () => {
  it('resolves against the authorize url, not the fhir base', () => {
    expect(getEpicRegistrationUrl(NORTHWELL_R4_ID)).toBe(
      'https://call.api.northwell.io/epic-proxy/oauth2/register',
    );
  });

  it('resolves the same registration url for a same-host tenant with uppercase FHIR path', () => {
    expect(getEpicRegistrationUrl(VIVO_PHARMACY_R4_ID)).toBe(
      'https://call.api.northwell.io/epic-proxy/oauth2/register',
    );
  });

  it('keeps a path prefix that sits above the fhir base', () => {
    expect(getEpicRegistrationUrl(OCHIN_AACI_R4_ID)).toBe(
      'https://webprd.ochin.org/prd-fhir/MyChartAACI/oauth2/register',
    );
  });

  it('resolves registration urls for DSTU2 tenants', () => {
    expect(getEpicRegistrationUrl(LOMA_LINDA_DSTU2_ID)).toBe(
      'https://prd.lluh.org/fhir/oauth2/register',
    );
  });

  it('uses the authorization host when it differs from the fhir host', () => {
    expect(getEpicRegistrationUrl(UCHICAGO_DSTU2_ID)).toBe(
      'https://epicproxy.et0169.epichosted.com/APIProxyPRD/oauth2/register',
    );
  });

  it('uses the authorization path tree, not the fhir path tree', () => {
    expect(getEpicRegistrationUrl(KAISER_NORTHWEST_R4_ID)).toBe(
      'https://fhir.kp.org/KPPolarisPortal/esb-envlbl/190/oauth2/register',
    );
  });

  it('uses the authorization path casing rather than the fhir path casing', () => {
    expect(getEpicRegistrationUrl(FROEDTERT_DSTU2_ID)).toBe(
      'https://epicservicegw.froedtert.com/FHIRproxyPRD/oauth2/register',
    );
  });

  it('follows a FHIRProxy to APIProxyPRD path remap on the same host', () => {
    expect(getEpicRegistrationUrl(DREXEL_DSTU2_ID)).toBe(
      'https://epicproxy.et4001.epichosted.com/APIProxyPRD/oauth2/register',
    );
  });

  it('follows a FhirProxy to FHIRproxy path remap on the same host', () => {
    expect(getEpicRegistrationUrl(KELSEY_SEYBOLD_DSTU2_ID)).toBe(
      'https://ssrx.ksnet.com/FHIRproxy/oauth2/register',
    );
  });

  it('resolves registration urls for the sandbox tenants', () => {
    expect(getEpicRegistrationUrl(SANDBOX_DSTU2_ID)).toBe(
      'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/register',
    );
    expect(getEpicRegistrationUrl(SANDBOX_R4_ID)).toBe(
      'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/register',
    );
  });

  it('returns undefined for an unknown id', () => {
    expect(getEpicRegistrationUrl('not-a-tenant')).toBeUndefined();
  });
});

describe('endpoint data invariants', () => {
  const allEndpoints = [
    ...EpicDSTU2TenantEndpoints,
    ...EpicR4TenantEndpoints,
  ];

  it('gives every tenant a base url ending in a slash so relative paths resolve', () => {
    const notEndingInSlash = allEndpoints
      .filter((e) => !e.url.endsWith('/'))
      .map((e) => e.url);

    expect(notEndingInSlash).toEqual([]);
  });

  it('gives every tenant an authorize url ending in /authorize', () => {
    const notEndingInAuthorize = allEndpoints
      .filter((e) => !e.authorize.endsWith('/authorize'))
      .map((e) => e.authorize);

    expect(notEndingInAuthorize).toEqual([]);
  });

  it('gives every tenant a unique id across DSTU2 and R4', () => {
    const ids = allEndpoints.map((e) => e.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('treats tenant ids as opaque strings rather than uuids', () => {
    expect(findEpicTenantById(SANDBOX_DSTU2_ID)?.name).toBe(
      'Epic MyChart Sandbox',
    );
    expect(findEpicTenantById(SANDBOX_R4_ID)?.name).toBe(
      'Epic MyChart Sandbox (R4)',
    );
  });

  it('allows a tenant with no managing organization', () => {
    expect(findEpicTenantById(SANDBOX_DSTU2_ID)?.managingOrganization).toBe(
      undefined,
    );
  });

  it('lets many tenants have an authorize path tree above the fhir path tree', () => {
    const differing = allEndpoints.filter(
      (e) =>
        !e.authorize
          .replace('/oauth2/authorize', '/')
          .startsWith(e.url.split('/api/')[0] + '/'),
    );

    expect(differing.length).toBeGreaterThan(50);
  });

  it('lets many tenants share one fhir base url, so the url is not an identity', () => {
    const urls = allEndpoints.map((e) => e.url);
    const shared = urls.filter(
      (url) => urls.filter((other) => other === url).length > 1,
    );

    expect(shared.length).toBeGreaterThan(100);
  });
});
