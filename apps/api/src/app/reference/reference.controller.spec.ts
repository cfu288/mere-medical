import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { openReferencesDb, writeReference } from '@mere/reference-pipeline';
import { ReferenceModule } from './reference.module';

function libraryFile(): string {
  const path = join(
    mkdtempSync(join(tmpdir(), 'references-')),
    'references.db',
  );
  const db = openReferencesDb(path);
  writeReference(db, {
    id: 'va-dod-hypertension',
    title: 'VA-DoD Hypertension Guideline',
    edition: '2026',
    summary: 'Adults; BP goals',
    url: 'https://example.com/htn.pdf',
    markdown:
      '# IX. Recommendations\n\n## Page 34\n\nWe recommend a systolic goal of <130 mmHg.',
    sections: [
      {
        sectionId: 'ix-recommendations',
        parentId: null,
        title: 'IX. Recommendations',
        textStart: 21,
        textEnd: 21,
      },
      {
        sectionId: 'page-34',
        parentId: 'ix-recommendations',
        title: 'Page 34',
        textStart: 35,
        textEnd: 77,
      },
    ],
    chunks: [
      {
        sectionId: 'page-34',
        chunk: 1,
        text: 'We recommend a systolic goal of <130 mmHg.',
      },
    ],
  });
  db.close();
  return path;
}

async function appWith(path: string): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [ReferenceModule.register(path)],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  return app;
}

const hypertension = {
  id: 'va-dod-hypertension',
  title: 'VA-DoD Hypertension Guideline',
  edition: '2026',
  summary: 'Adults; BP goals',
  url: 'https://example.com/htn.pdf',
};

describe('ReferenceModule with a library file', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await appWith(libraryFile());
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists a page of the references in the library', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references?page=1',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      references: [hypertension],
      total: 1,
      page: 1,
      pageSize: 50,
    });
  });

  it('searches reference titles and summaries with repeated q terms', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/search?q=kidney&q=hypertension',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      references: [hypertension],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('reads an unreadable page number as the first page', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/search?q=hypertension&page=abc',
    );

    expect(response.body).toEqual({
      references: [hypertension],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('returns the outline of a reference', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/outline',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reference: hypertension,
      section: null,
      sections: [
        {
          sectionId: 'ix-recommendations',
          title: 'IX. Recommendations',
          chars: 0,
          chunks: 0,
          subsections: [
            {
              sectionId: 'page-34',
              title: 'Page 34',
              chars: 42,
              chunks: 1,
              subsectionCount: 0,
            },
          ],
        },
      ],
    });
  });

  it('returns the outline under a section', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/outline/ix-recommendations',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reference: hypertension,
      section: {
        sectionId: 'ix-recommendations',
        title: 'IX. Recommendations',
        chars: 0,
        chunks: 0,
      },
      sections: [
        {
          sectionId: 'page-34',
          title: 'Page 34',
          chars: 42,
          chunks: 1,
          subsections: [],
        },
      ],
    });
  });

  it('returns one chunk of a section', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/sections/page-34/chunks/1',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reference: hypertension,
      section: { sectionId: 'page-34', title: 'Page 34' },
      chunk: 1,
      chunks: 1,
      text: 'We recommend a systolic goal of <130 mmHg.',
    });
  });

  it('finds the chunks of one reference matching any repeated q term', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/find?q=systolic&q=diastolic',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      matches: [
        {
          sectionId: 'page-34',
          title: 'Page 34',
          chunk: 1,
          count: 1,
          excerpt: 'We recommend a systolic goal of <130 mmHg.',
        },
      ],
    });
  });

  it.each([
    ['/v1/agent/references/nope/outline', 'no-reference'],
    ['/v1/agent/references/nope/sections/page-34/chunks/1', 'no-reference'],
    ['/v1/agent/references/nope/find?q=x', 'no-reference'],
    ['/v1/agent/references/va-dod-hypertension/outline/nope', 'no-section'],
    [
      '/v1/agent/references/va-dod-hypertension/sections/nope/chunks/1',
      'no-section',
    ],
    [
      '/v1/agent/references/va-dod-hypertension/sections/page-34/chunks/2',
      'no-chunk',
    ],
    [
      '/v1/agent/references/va-dod-hypertension/sections/page-34/chunks/one',
      'no-chunk',
    ],
  ])('answers 404 for %s', async (url, error) => {
    const response = await request(app.getHttpServer()).get(url);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error });
  });
});

describe('ReferenceModule with a file that is not a library', () => {
  it('refuses to start', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'references-')), 'empty.db');
    writeFileSync(path, '');

    await expect(appWith(path)).rejects.toThrow(
      'has schema version 0, expected 1',
    );
  });
});
