import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { parseCCDAAssesmentSection } from './parseCCDAAssesmentSection';
Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: crypto.webcrypto.subtle,
  },
});

describe('parseCCDAAssesmentSection', () => {
  it('parses list of assessments', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(__dirname, './exampleCCDA/example_assessment.xml'),
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAAssesmentSection(sections, [
      '2.16.840.1.113883.10.20.22.2.8',
    ]);

    expect(results).not.toBeNull();
    expect(results.title).toBe('Visit Diagnoses');
    expect(results?.value).not.toBeNull();
  });
});
