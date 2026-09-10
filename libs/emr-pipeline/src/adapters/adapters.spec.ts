import * as fs from 'node:fs';
import * as path from 'node:path';
import { adapterFor } from './index';
import { fhirBundleSchema } from './schemas';

const FIXTURES = path.join(__dirname, '__fixtures__');

function readBundle(name: string) {
  const body = fs.readFileSync(path.join(FIXTURES, name), 'utf8');
  const parsed = fhirBundleSchema.safeParse(JSON.parse(body));
  if (!parsed.success) throw new Error(`${name} is not a FHIR bundle`);
  return parsed.data;
}

describe('vendor adapters', () => {
  it('requires the FHIR Bundle resource discriminator', () => {
    expect(fhirBundleSchema.safeParse({}).success).toBe(false);
  });

  it('gives athena no per tenant capability url', () => {
    expect(
      adapterFor('athena').capabilityUrl({
        tenantId: '1',
        url: 'https://api.platform.athenahealth.com/fhir/r4',
      }),
    ).toBeNull();
  });

  it('appends metadata to an epic base url that already ends in a slash', () => {
    expect(
      adapterFor('epic').capabilityUrl({
        tenantId: '1',
        url: 'https://example.org/api/FHIR/R4/',
      }),
    ).toBe('https://example.org/api/FHIR/R4/metadata');
  });

  it('inserts a slash before metadata for a healow base url', () => {
    expect(
      adapterFor('healow').capabilityUrl({
        tenantId: 'AACJCD',
        url: 'https://fhir4.eclinicalworks.com/fhir/r4/AACJCD',
      }),
    ).toBe('https://fhir4.eclinicalworks.com/fhir/r4/AACJCD/metadata');
  });

  it('uses the patient-facing cerner host and host-scoped sandbox token urls', () => {
    for (const version of ['DSTU2', 'R4'] as const) {
      const [seed] = adapterFor('cerner').sandbox(version);
      expect(seed.url).toContain('https://fhir-myrecord.cerner.com/');
      expect(seed.token).toContain('/hosts/fhir-myrecord.cerner.com/');
    }
  });

  it('uses the endpoints declared by the live veradigm sandbox capability', () => {
    const [seed] = adapterFor('veradigm').sandbox('DSTU2');

    expect(seed).toMatchObject({
      url: 'https://fhir.fhirpoint.open.allscripts.com/fhirroute/fhir/CustProProdSand201SMART/',
      token:
        'https://fhir.fhirpoint.open.allscripts.com/fhirroute/authorization/CustProProdSand201SMART/connect/token',
      authorize:
        'https://fhir.fhirpoint.open.allscripts.com/fhirroute/authorization/CustProProdSand201SMART/connect/authorize',
    });
  });

  it('sends the epic client id header only when configured', () => {
    delete process.env['EPIC_CLIENT_ID'];
    expect(adapterFor('epic').capabilityHeaders?.()).toEqual({});

    process.env['EPIC_CLIENT_ID'] = 'client-123';
    expect(adapterFor('epic').capabilityHeaders?.()).toEqual({
      'Epic-Client-ID': 'client-123',
    });
    delete process.env['EPIC_CLIENT_ID'];
  });

  it('uses the current healow sandbox host', () => {
    const [seed] = adapterFor('healow').sandbox('R4');

    expect(seed).toMatchObject({
      url: 'https://fhir4.eclinicalworks.com/fhir/r4/JAFJCD',
    });
  });
});

describe('veradigm directory bundle', () => {
  const bundle = readBundle('veradigm-dstu2-directory.json');

  it('takes the tenant id and name from the contained organization', () => {
    const entries = adapterFor('veradigm').parseDirectory(bundle);

    expect(entries[1]).toEqual({
      tenantId: '4e6b2a54-a695-49ce-8fe1-e76c31dfbd25',
      name: 'Baldwin Family Medicine',
      url: 'https://fhir.fhirpoint.open.allscripts.com/fhirroute/fhir/10044205/',
    });
  });

  it('keeps a nameless tenant out of the entries it names', () => {
    const entries = adapterFor('veradigm').parseDirectory(bundle);

    expect(entries[0].name).toBe('');
  });

  it('holds fewer entries than the total the bundle declares', () => {
    const entries = adapterFor('veradigm').parseDirectory(bundle);

    expect({ declaredTotal: bundle.total, entries: entries.length }).toEqual({
      declaredTotal: 3326,
      entries: 2,
    });
  });
});

describe('veradigm r4 directory bundle', () => {
  const bundle = readBundle('veradigm-r4-directory.json');

  it('reads r4 tenants from the same contained organization shape', () => {
    const entries = adapterFor('veradigm').parseDirectory(bundle);

    expect(entries.map((entry) => entry.name)).toEqual([
      'Baldwin Family Medicine',
      'Fuller Living and Assoc, LLC',
    ]);
  });

  it('falls back to the endpoint name when the contained organization is nameless', () => {
    const nameless = fhirBundleSchema.parse({
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Endpoint',
            id: 'ep-1',
            name: 'Riverside Family Practice',
            contained: [{ resourceType: 'Organization', id: 'org-1' }],
            address: 'https://fhir.example.org/fhirroute/fhir/12345',
          },
        },
      ],
    });

    expect(adapterFor('veradigm').parseDirectory(nameless)).toEqual([
      {
        tenantId: 'org-1',
        name: 'Riverside Family Practice',
        url: 'https://fhir.example.org/fhirroute/fhir/12345/',
      },
    ]);
  });
});

describe('healow directory bundle', () => {
  const bundle = readBundle('healow-directory.json');

  it('reads one tenant per endpoint from the practice list', () => {
    const entries = adapterFor('healow').parseDirectory(bundle);

    expect(entries).toEqual([
      {
        tenantId: 'AACJCD',
        name: 'Pointcare Medical Center LLC',
        url: 'https://fhir4.healow.com/fhir/r4/AACJCD',
      },
      {
        tenantId: 'IAJHCD',
        name: 'Rochester Skin Cancer and Surgery Center',
        url: 'https://fhir4.healow.com/fhir/r4/IAJHCD',
      },
      {
        tenantId: 'IFJFCD',
        name: 'Illinois Pain Treatment Institute',
        url: 'https://fhir4.healow.com/fhir/r4/IFJFCD',
      },
    ]);
  });

  it('prefers the organization name over the endpoint name regardless of order', () => {
    const organizationFirst = fhirBundleSchema.parse({
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Organization',
            id: 'AACJCD',
            name: 'Pointcare Medical Center',
          },
        },
        {
          resource: {
            resourceType: 'Endpoint',
            id: 'AACJCD',
            name: 'pointcare',
            address: 'https://fhir4.healow.com/fhir/r4/AACJCD',
          },
        },
      ],
    });

    expect(adapterFor('healow').parseDirectory(organizationFirst)).toEqual([
      {
        tenantId: 'AACJCD',
        name: 'Pointcare Medical Center',
        url: 'https://fhir4.healow.com/fhir/r4/AACJCD',
      },
    ]);
  });
});

describe('cerner r4 directory bundle', () => {
  const bundle = readBundle('cerner-r4-directory.json');

  it('names a tenant from the organization that points at its endpoint', () => {
    const entries = adapterFor('cerner').parseDirectory(bundle);

    expect(entries[0]).toEqual({
      tenantId: '-KzIoYV6gk-ILcHOWbsH2m9KsSdDgi12',
      name: 'Oscar Matthews, MD',
      url: 'https://fhir-myrecord.cerner.com/r4/-KzIoYV6gk-ILcHOWbsH2m9KsSdDgi12/',
    });
  });

  it('names every tenant in the bundle', () => {
    const entries = adapterFor('cerner').parseDirectory(bundle);

    expect(entries.filter((entry) => !entry.name)).toEqual([]);
  });
});

describe('cerner dstu2 directory bundle', () => {
  const bundle = readBundle('cerner-dstu2-directory.json');

  it('names a tenant from its contained organization', () => {
    const entries = adapterFor('cerner').parseDirectory(bundle);

    expect(entries[0]).toEqual({
      tenantId: '-KzIoYV6gk-ILcHOWbsH2m9KsSdDgi12',
      name: 'Oscar Matthews, MD',
      url: 'https://fhir-myrecord.cerner.com/dstu2/-KzIoYV6gk-ILcHOWbsH2m9KsSdDgi12/',
    });
  });

  it('leaves every base url ending in a slash', () => {
    const entries = adapterFor('cerner').parseDirectory(bundle);

    expect(entries.filter((entry) => !entry.url.endsWith('/'))).toEqual([]);
  });
});

describe('athena directory bundle', () => {
  const bundle = readBundle('athena-directory.json');
  const entries = adapterFor('athena').parseDirectory(bundle);

  it('emits one entry per practice, not one per organization', () => {
    expect(entries.map((entry) => entry.tenantId)).toEqual(['10', '21260']);
  });

  it('names only a practice whose member organizations agree', () => {
    expect(entries.map((entry) => entry.name)).toEqual([
      'Anchor Medical Associates',
      undefined,
    ]);
  });

  it('ignores an organization carrying no practice reference', () => {
    expect(
      entries.filter((entry) => entry.name === 'No Practice Extension'),
    ).toEqual([]);
  });

  it('points every practice at the shared athena base url', () => {
    expect([...new Set(entries.map((entry) => entry.url))]).toEqual([
      'https://api.platform.athenahealth.com/fhir/r4',
    ]);
  });

  it('keeps a practice whose organization omits the optional name', () => {
    const nameless = fhirBundleSchema.parse({
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Organization',
            extension: [
              {
                url: 'https://fhir.athena.io/StructureDefinition/ah-practice',
                valueReference: { reference: 'Practice-99' },
              },
            ],
          },
        },
      ],
    });

    expect(adapterFor('athena').parseDirectory(nameless)).toEqual([
      {
        tenantId: '99',
        name: undefined,
        url: 'https://api.platform.athenahealth.com/fhir/r4',
      },
    ]);
  });
});
