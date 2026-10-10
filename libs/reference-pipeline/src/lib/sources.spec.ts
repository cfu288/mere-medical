import { parseSources } from './sources';

describe('parseSources', () => {
  it('parses every source type, trimming text, and coercing a cdc media id', () => {
    expect(
      parseSources([
        {
          id: ' uspstf-a-and-b ',
          title: ' USPSTF A and B Recommendations ',
          edition: ' Updated continuously ',
          summary: 'Screening and prevention for adults and children',
          url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations',
          type: 'html',
        },
        {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2026',
          summary: 'Adults; diagnosis, BP goals, drug choice, home monitoring',
          url: 'https://example.com/htn.pdf',
          type: 'pdf',
        },
        {
          id: 'cdc-adult-schedule-by-age',
          title: 'CDC Adult Immunization Schedule by Age',
          edition: '2025',
          summary: 'Vaccines adults get by age',
          type: 'cdc-media',
          mediaId: ' 266012 ',
        },
      ]),
    ).toEqual([
      {
        id: 'uspstf-a-and-b',
        title: 'USPSTF A and B Recommendations',
        edition: 'Updated continuously',
        summary: 'Screening and prevention for adults and children',
        url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations',
        type: 'html',
      },
      {
        id: 'va-dod-hypertension',
        title: 'VA-DoD Hypertension Guideline',
        edition: '2026',
        summary: 'Adults; diagnosis, BP goals, drug choice, home monitoring',
        url: 'https://example.com/htn.pdf',
        type: 'pdf',
      },
      {
        id: 'cdc-adult-schedule-by-age',
        title: 'CDC Adult Immunization Schedule by Age',
        edition: '2025',
        summary: 'Vaccines adults get by age',
        type: 'cdc-media',
        mediaId: 266012,
      },
    ]);
  });

  it('rejects an id that is not lowercase words joined by hyphens', () => {
    expect(() =>
      parseSources([
        {
          id: 'VA/DoD HTN',
          title: 'x',
          edition: '2026',
          summary: 'x',
          url: 'https://example.com/x.pdf',
          type: 'pdf',
        },
      ]),
    ).toThrow();
  });

  it('rejects two sources with the same id', () => {
    const source = {
      id: 'va-dod-ckd',
      title: 'x',
      edition: '2025',
      summary: 'x',
      url: 'https://example.com/x.pdf',
      type: 'pdf',
    };
    expect(() => parseSources([source, source])).toThrow();
  });
});
