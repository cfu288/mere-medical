import { contextAfterRefresh, resolveSyncContext } from './resolveSyncContext';

function connectionOf(doc: Record<string, unknown>) {
  return { toMutableJSON: () => ({ ...doc }) } as any;
}

function resolve(doc: Record<string, unknown>) {
  return resolveSyncContext({
    config: {} as any,
    db: {} as any,
    connection: connectionOf(doc),
    useProxy: false,
  });
}

const epicBase = {
  id: 'c1',
  user_id: 'u1',
  source: 'epic',
  name: 'Epic',
  access_token: 'token',
  expires_at: 1893456000,
  patient: 'patient-1',
};

describe('resolveSyncContext', () => {
  it('uses the stored Epic fhir base url', () => {
    const result = resolve({
      ...epicBase,
      location: 'https://legacy.example.org/prd/api/FHIR/DSTU2/',
    });

    expect(result.ok && result.ctx.fhirBaseUrl).toBe(
      'https://legacy.example.org/prd/api/FHIR/DSTU2/',
    );
  });

  it('fails when an Epic connection stores only an origin', () => {
    const result = resolve({
      ...epicBase,
      location: 'https://legacy.example.org',
    });

    expect(result.ok).toBe(false);
  });

  it('gives OnPatient its fhir base rather than its stored origin', () => {
    const result = resolve({
      id: 'c5',
      user_id: 'u1',
      source: 'onpatient',
      name: 'OnPatient',
      location: 'https://onpatient.com',
      access_token: 'token',
      expires_at: 1893456000,
    });

    expect(result.ok && result.ctx.fhirBaseUrl).toBe(
      'https://onpatient.com/api/fhir',
    );
  });

  it('uses the stored location for vendors that publish no endpoint list', () => {
    const result = resolve({
      id: 'c6',
      user_id: 'u1',
      source: 'cerner',
      name: 'Cerner',
      location: 'https://cerner.example/',
      access_token: 'token',
      expires_at: 1893456000,
      id_token: 'token',
    });

    expect(result.ok && result.ctx.fhirBaseUrl).toBe('https://cerner.example/');
  });
});

describe('contextAfterRefresh', () => {
  it('picks up a token written after the context was built', () => {
    const stored: Record<string, unknown> = {
      ...epicBase,
      tenant_id: '1a5fe784-078b-ef11-91a4-0050568bc890',
      location: 'https://call.api.northwell.io/epic-proxy/api/fhir/R4/',
      access_token: 'stale-token',
    };
    const resolved = resolveSyncContext({
      config: {} as any,
      db: {} as any,
      connection: connectionOf(stored),
      useProxy: false,
    });
    if (!resolved.ok) throw new Error('expected a resolved context');

    stored['access_token'] = 'fresh-token';

    expect(resolved.ctx.document.access_token).toBe('stale-token');
    expect(contextAfterRefresh(resolved.ctx).document.access_token).toBe(
      'fresh-token',
    );
  });
});
