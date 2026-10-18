import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { TWO_PAGE_PDF } from './__fixtures__/twoPagePdf';
import { buildReferenceLibrary } from './ingest';
import { openReferencesDb } from './referencesDb';
import { Source } from './sources';

/** Serves each url its listed body and fails on any url not listed. */
function fakeFetch(bodies: Record<string, string>) {
  return async (url: string): Promise<Uint8Array> => {
    const body = bodies[url];
    if (body === undefined) {
      throw new Error(`no fake body for ${url}`);
    }
    return new TextEncoder().encode(body);
  };
}

const USPSTF: Source = {
  id: 'uspstf-a-and-b',
  title: 'USPSTF A and B Recommendations',
  edition: 'Updated continuously',
  summary: 'Screening and prevention',
  url: 'https://example.com/ab',
  type: 'html',
};

const CDC_ADULT: Source = {
  id: 'cdc-adult-schedule',
  title: 'CDC Adult Immunization Schedule',
  edition: '2026',
  summary: 'Vaccines for adults',
  url: 'https://example.com/adult.pdf',
  type: 'pdf',
};

function libraryPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'references-')), 'references.db');
}

describe('buildReferenceLibrary', () => {
  it('stores an html source with its configured description, its markdown and its sections, reporting its section count', async () => {
    const path = libraryPath();
    const report = await buildReferenceLibrary({
      path,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab':
          '<h1>Screening</h1><p>Screen adults.</p><h2>Hypertension</h2><p>Measure blood pressure.</p><h1>References</h1><p>1. Smith.</p>',
      }),
    });
    const db = openReferencesDb(path);

    expect(
      db
        .prepare(
          'SELECT id, title, edition, summary, url, content_md FROM documents',
        )
        .all(),
    ).toEqual([
      {
        id: 'uspstf-a-and-b',
        title: 'USPSTF A and B Recommendations',
        edition: 'Updated continuously',
        summary: 'Screening and prevention',
        url: 'https://example.com/ab',
        content_md:
          '# Screening\n\nScreen adults.\n\n## Hypertension\n\nMeasure blood pressure.\n\n# References\n\n1\\. Smith.',
      },
    ]);
    expect(report).toEqual([
      {
        id: 'uspstf-a-and-b',
        status: 'written',
        sections: 3,
      },
    ]);
  });

  it('stores a pdf source with one section per pdf page', async () => {
    const path = libraryPath();
    await buildReferenceLibrary({
      path,
      sources: [CDC_ADULT],
      fetchBytes: fakeFetch({ 'https://example.com/adult.pdf': TWO_PAGE_PDF }),
    });

    expect(
      openReferencesDb(path)
        .prepare('SELECT content_md, sections FROM documents')
        .all(),
    ).toEqual([
      {
        content_md:
          '# Page 1\n\nI. Introduction\nTdap booster every 10 years.\nBMI of 30 kg/m2 or more.\n\n# Page 2\n\nRepeat every 10 years.',
        sections:
          '[{"sectionId":"page-1","parentId":null,"title":"Page 1","textStart":10,"textEnd":79},{"sectionId":"page-2","parentId":null,"title":"Page 2","textStart":91,"textEnd":113}]',
      },
    ]);
    expect(
      openReferencesDb(path)
        .prepare('SELECT document_id, section_id, part, text FROM parts_fts')
        .all(),
    ).toEqual([
      {
        document_id: 'cdc-adult-schedule',
        section_id: 'page-1',
        part: 1,
        text: 'I. Introduction\nTdap booster every 10 years.\nBMI of 30 kg/m2 or more.',
      },
      {
        document_id: 'cdc-adult-schedule',
        section_id: 'page-2',
        part: 1,
        text: 'Repeat every 10 years.',
      },
    ]);
  });

  it('stores a cdc media source under the cdc page it syndicates', async () => {
    const path = libraryPath();
    await buildReferenceLibrary({
      path,
      sources: [
        {
          id: 'cdc-about-shingles',
          title: 'CDC: About Shingles',
          edition: '2025',
          summary: 'Shingles basics',
          type: 'cdc-media',
          mediaId: 1,
        },
      ],
      fetchBytes: fakeFetch({
        'https://tools.cdc.gov/api/v2/resources/media/1.json':
          '{"results":[{"sourceUrl":"https://www.cdc.gov/shingles/about/index.html"}]}',
        'https://tools.cdc.gov/api/v2/resources/media/1/content.html':
          '<h2>About</h2><p>Shingles is a painful rash.</p>',
      }),
    });

    expect(
      openReferencesDb(path).prepare('SELECT id, url FROM documents').all(),
    ).toEqual([
      {
        id: 'cdc-about-shingles',
        url: 'https://www.cdc.gov/shingles/about/index.html',
      },
    ]);
  });

  it('replaces the previous library with one holding only the configured sources', async () => {
    const path = libraryPath();
    const adultPage: Source = {
      ...CDC_ADULT,
      type: 'html',
      url: 'https://example.com/adult',
    };
    const fetchBytes = fakeFetch({
      'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      'https://example.com/adult': '<h1>Adults</h1><p>Tdap every 10 years.</p>',
    });
    await buildReferenceLibrary({
      path,
      sources: [USPSTF, adultPage],
      fetchBytes,
    });
    await buildReferenceLibrary({ path, sources: [adultPage], fetchBytes });

    expect(
      openReferencesDb(path).prepare('SELECT id FROM documents').all(),
    ).toEqual([{ id: 'cdc-adult-schedule' }]);
  });

  it('reports a source that parses to no text and stores nothing for it', async () => {
    const path = libraryPath();

    const report = await buildReferenceLibrary({
      path,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab': '<h1>Screening</h1><script>x()</script>',
      }),
    });

    expect(report).toEqual([{ id: 'uspstf-a-and-b', status: 'empty' }]);
    expect(
      openReferencesDb(path).prepare('SELECT id FROM documents').all(),
    ).toEqual([]);
  });

  it('leaves the previous library as it was when any fetch fails', async () => {
    const path = libraryPath();
    await buildReferenceLibrary({
      path,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      }),
    });

    await expect(
      buildReferenceLibrary({
        path,
        sources: [USPSTF, CDC_ADULT],
        fetchBytes: fakeFetch({ 'https://example.com/ab': '<h1>Changed</h1>' }),
      }),
    ).rejects.toThrow('no fake body for https://example.com/adult.pdf');

    expect([
      openReferencesDb(path).prepare('SELECT content_md FROM documents').all(),
      existsSync(`${path}.building`),
    ]).toEqual([[{ content_md: '# Screening\n\nScreen adults.' }], false]);
  });
});
