import {
  extractRelativeFhirPath,
  relativeFhirPathWithin,
  resolveFhirUrl,
  deriveRegistrationUrl,
} from './url-utils';

describe('extractRelativeFhirPath', () => {
  describe('Epic R4 URLs', () => {
    const baseUrl = 'https://fhir.epic.com/api/FHIR/R4/';

    it('extracts resource path from absolute pagination URL', () => {
      const nextUrl = 'https://fhir.epic.com/api/FHIR/R4/Patient?page=2&_count=100';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?page=2&_count=100');
    });

    it('handles base URL without trailing slash', () => {
      const baseWithoutSlash = 'https://fhir.epic.com/api/FHIR/R4';
      const nextUrl = 'https://fhir.epic.com/api/FHIR/R4/Observation?patient=123&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseWithoutSlash)).toBe('Observation?patient=123&page=2');
    });

    it('handles complex query parameters', () => {
      const nextUrl = 'https://fhir.epic.com/api/FHIR/R4/Observation?patient=123&category=laboratory&_count=50&page=3';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Observation?patient=123&category=laboratory&_count=50&page=3');
    });

    it('handles URLs with no query parameters', () => {
      const nextUrl = 'https://fhir.epic.com/api/FHIR/R4/Patient';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient');
    });
  });

  describe('Epic DSTU2 URLs', () => {
    const baseUrl = 'https://fhir.epic.com/api/FHIR/DSTU2/';

    it('extracts resource path from DSTU2 pagination URL', () => {
      const nextUrl = 'https://fhir.epic.com/api/FHIR/DSTU2/MedicationStatement?patient=abc&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('MedicationStatement?patient=abc&page=2');
    });
  });

  describe('Healow URLs', () => {
    const baseUrl = 'https://healow.com/apps/api/fhir/r4/';

    it('extracts resource path from Healow pagination URL', () => {
      const nextUrl = 'https://healow.com/apps/api/fhir/r4/Condition?patient=xyz&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Condition?patient=xyz&page=2');
    });
  });

  describe('VA URLs', () => {
    const baseUrl = 'https://sandbox-api.va.gov/services/fhir/v0/r4/';

    it('extracts resource path from VA pagination URL', () => {
      const nextUrl = 'https://sandbox-api.va.gov/services/fhir/v0/r4/Immunization?patient=123&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Immunization?patient=123&page=2');
    });
  });

  describe('edge cases', () => {
    it('handles encoded query parameters', () => {
      const baseUrl = 'https://fhir.example.com/api/';
      const nextUrl = 'https://fhir.example.com/api/Patient?name=John%20Doe&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?name=John%20Doe&page=2');
    });

    it('handles nested resource paths', () => {
      const baseUrl = 'https://fhir.example.com/';
      const nextUrl = 'https://fhir.example.com/Patient/123/$everything?page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient/123/$everything?page=2');
    });

    it('handles base URL that is just origin', () => {
      const baseUrl = 'https://fhir.example.com/';
      const nextUrl = 'https://fhir.example.com/Patient?page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?page=2');
    });

    it('handles relative URLs', () => {
      const baseUrl = 'https://fhir.epic.com/api/FHIR/R4/';
      const nextUrl = 'Patient?page=2&_count=100';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?page=2&_count=100');
    });

    it('handles relative URLs with leading slash', () => {
      const baseUrl = 'https://fhir.epic.com/api/FHIR/R4/';
      const nextUrl = '/api/FHIR/R4/Patient?page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?page=2');
    });
  });
});

describe('resolveFhirUrl', () => {
  it('appends a resource to a base url', () => {
    expect(
      resolveFhirUrl('https://fhir.epic.com/api/FHIR/R4/', 'Patient'),
    ).toBe('https://fhir.epic.com/api/FHIR/R4/Patient');
  });

  it('keeps the full path when the base url has no trailing slash', () => {
    expect(
      resolveFhirUrl(
        'https://webprd.ochin.org/prd-fhir/MyChartAACI/api/FHIR/R4',
        'Patient',
      ),
    ).toBe('https://webprd.ochin.org/prd-fhir/MyChartAACI/api/FHIR/R4/Patient');
  });

  it('preserves a lowercase fhir path segment', () => {
    expect(
      resolveFhirUrl(
        'https://call.api.northwell.io/epic-proxy/api/fhir/R4/',
        'Observation',
      ),
    ).toBe('https://call.api.northwell.io/epic-proxy/api/fhir/R4/Observation');
  });

  it('does not produce a double slash when the resource path has a leading slash', () => {
    expect(
      resolveFhirUrl('https://fhir.epic.com/api/FHIR/R4/', '/Patient'),
    ).toBe('https://fhir.epic.com/api/FHIR/R4/Patient');
  });

  it('keeps nested resource paths intact', () => {
    expect(
      resolveFhirUrl(
        'https://fhir.epic.com/api/FHIR/R4/',
        'Patient/123/$everything',
      ),
    ).toBe('https://fhir.epic.com/api/FHIR/R4/Patient/123/$everything');
  });

  it('appends search params', () => {
    expect(
      resolveFhirUrl(
        'https://fhir.epic.com/api/FHIR/R4/',
        'Observation',
        new URLSearchParams({ patient: '123', category: 'laboratory' }),
      ),
    ).toBe(
      'https://fhir.epic.com/api/FHIR/R4/Observation?patient=123&category=laboratory',
    );
  });

  it('omits the question mark when there are no search params', () => {
    expect(
      resolveFhirUrl(
        'https://fhir.epic.com/api/FHIR/R4/',
        'Patient',
        new URLSearchParams(),
      ),
    ).toBe('https://fhir.epic.com/api/FHIR/R4/Patient');
  });

  it('encodes search param values', () => {
    expect(
      resolveFhirUrl(
        'https://fhir.epic.com/api/FHIR/R4/',
        'Patient',
        new URLSearchParams({ name: 'John Doe' }),
      ),
    ).toBe('https://fhir.epic.com/api/FHIR/R4/Patient?name=John+Doe');
  });

  it('round-trips with extractRelativeFhirPath', () => {
    const baseUrl = 'https://webprd.ochin.org/prd-fhir/MyChartAACI/api/FHIR/R4/';
    const resolved = resolveFhirUrl(
      baseUrl,
      'Observation',
      new URLSearchParams({ patient: '123' }),
    );

    expect(extractRelativeFhirPath(resolved, baseUrl)).toBe(
      'Observation?patient=123',
    );
  });
});

describe('relativeFhirPathWithin', () => {
  const baseUrl = 'https://tenant.example/prd-fhir/api/FHIR/R4/';

  it('returns the resource path for a url under the fhir base', () => {
    expect(
      relativeFhirPathWithin(
        'https://tenant.example/prd-fhir/api/FHIR/R4/Patient?page=2',
        baseUrl,
      ),
    ).toBe('Patient?page=2');
  });

  it('returns null for a url on another host', () => {
    expect(
      relativeFhirPathWithin('https://cdn.example/document.pdf', baseUrl),
    ).toBeNull();
  });

  it('returns null for a url on the same host outside the fhir base', () => {
    expect(
      relativeFhirPathWithin(
        'https://tenant.example/other/thing.pdf',
        baseUrl,
      ),
    ).toBeNull();
  });

  it('returns null for a path that only shares a prefix with the fhir base', () => {
    expect(
      relativeFhirPathWithin(
        'https://tenant.example/prd-fhir/api/FHIR/R40/Patient',
        baseUrl,
      ),
    ).toBeNull();
  });

  it('returns an empty path for the fhir base itself without a trailing slash', () => {
    expect(
      relativeFhirPathWithin(
        'https://tenant.example/prd-fhir/api/FHIR/R4',
        baseUrl,
      ),
    ).toBe('');
  });
});

describe('deriveRegistrationUrl', () => {
  it('replaces the authorize segment with register', () => {
    expect(
      deriveRegistrationUrl(
        'https://call.api.northwell.io/epic-proxy/oauth2/authorize',
      ),
    ).toBe('https://call.api.northwell.io/epic-proxy/oauth2/register');
  });

  it('keeps a deep path prefix intact', () => {
    expect(
      deriveRegistrationUrl(
        'https://webprd.ochin.org/prd-fhir/MyChartAACI/oauth2/authorize',
      ),
    ).toBe('https://webprd.ochin.org/prd-fhir/MyChartAACI/oauth2/register');
  });

  it('handles an authorize url at the origin root', () => {
    expect(deriveRegistrationUrl('https://fhir.example.org/authorize')).toBe(
      'https://fhir.example.org/register',
    );
  });

  it('drops query params from the authorize url', () => {
    expect(
      deriveRegistrationUrl(
        'https://prd.lluh.org/fhir/oauth2/authorize?aud=test',
      ),
    ).toBe('https://prd.lluh.org/fhir/oauth2/register');
  });
});
