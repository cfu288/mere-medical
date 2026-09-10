import { classifyCapability } from './transform';

const SMART_URL =
  'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris';

function capability(uris: { url: string; valueUri: string }[]) {
  return JSON.stringify({
    resourceType: 'CapabilityStatement',
    fhirVersion: '4.0.1',
    publisher: 'Example Health',
    software: { name: 'Example FHIR Server' },
    rest: [{ security: { extension: [{ url: SMART_URL, extension: uris }] } }],
  });
}

describe('classifyCapability', () => {
  it('captures the register endpoint a client-gated statement declares', () => {
    const facts = classifyCapability(
      capability([
        { url: 'authorize', valueUri: 'https://example.org/oauth2/authorize' },
        { url: 'token', valueUri: 'https://example.org/oauth2/token' },
        { url: 'register', valueUri: 'https://example.org/oauth2/register' },
      ]),
    );

    expect(facts.registerUrl).toBe('https://example.org/oauth2/register');
  });

  it('reads authorize and token from the SMART oauth-uris extension', () => {
    const facts = classifyCapability(
      capability([
        { url: 'authorize', valueUri: 'https://example.org/oauth2/authorize' },
        { url: 'token', valueUri: 'https://example.org/oauth2/token' },
      ]),
    );

    expect(facts).toEqual({
      classification: 'usable',
      authorizeUrl: 'https://example.org/oauth2/authorize',
      tokenUrl: 'https://example.org/oauth2/token',
      registerUrl: undefined,
    });
  });

  it('classifies a statement whose security block declares no token uri', () => {
    const facts = classifyCapability(
      capability([
        { url: 'authorize', valueUri: 'https://example.org/oauth2/authorize' },
      ]),
    );

    expect(facts.classification).toBe('missing_token');
  });

  it('classifies a statement whose security block declares no authorize uri', () => {
    const facts = classifyCapability(
      capability([
        { url: 'token', valueUri: 'https://example.org/oauth2/token' },
      ]),
    );

    expect(facts.classification).toBe('missing_authorize');
  });

  it('classifies a capability statement carrying no security block', () => {
    const body = JSON.stringify({
      resourceType: 'CapabilityStatement',
      rest: [{ mode: 'server' }],
    });

    expect(classifyCapability(body).classification).toBe('no_security_block');
  });

  it('classifies an OperationOutcome body', () => {
    const body = JSON.stringify({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', diagnostics: 'No command was found' }],
    });

    expect(classifyCapability(body).classification).toBe('operation_outcome');
  });

  it('classifies an html error page as unparseable', () => {
    expect(
      classifyCapability('<html><body>502</body></html>').classification,
    ).toBe('unparseable');
  });

  it('classifies a truncated json body as unparseable', () => {
    expect(classifyCapability('{"resourceType":"Capabili').classification).toBe(
      'unparseable',
    );
  });

  it('reads a security block whose wrapper extension omits the smart url', () => {
    const body = JSON.stringify({
      resourceType: 'CapabilityStatement',
      rest: [
        {
          security: {
            extension: [
              {
                url: 'oauth-uris',
                extension: [
                  {
                    url: 'authorize',
                    valueUri: 'https://example.org/authorize',
                  },
                  { url: 'token', valueUri: 'https://example.org/token' },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(classifyCapability(body).classification).toBe('usable');
  });

  it('keeps unknown top level fields from failing the parse', () => {
    const body = JSON.stringify({
      resourceType: 'CapabilityStatement',
      somethingEpicAdded: { nested: true },
      rest: [
        {
          security: {
            extension: [
              {
                url: SMART_URL,
                extension: [
                  {
                    url: 'authorize',
                    valueUri: 'https://example.org/authorize',
                  },
                  { url: 'token', valueUri: 'https://example.org/token' },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(classifyCapability(body).classification).toBe('usable');
  });
});
