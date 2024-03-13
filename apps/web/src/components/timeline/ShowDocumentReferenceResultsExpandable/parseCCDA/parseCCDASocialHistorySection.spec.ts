import { parseDateString } from './parseCCDA';
import crypto from 'crypto';
Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: crypto.webcrypto.subtle,
  },
});
import fs from 'fs';
import path from 'path';
import { parseCCDASocialHistorySection } from './parseCCDASocialHistorySection';
import exp from 'constants';

describe('parseCCDASocialHistorySection', () => {
  it('parses former smoking status', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_social_history_former_smoking_status.xml',
        ),
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDASocialHistorySection(sections, [
      '2.16.840.1.113883.10.20.22.2.17',
    ]);

    expect(results).not.toBeNull();

    expect(results?.data['72166-2'].title).toBe('Tobacco smoking status NHIS');
    expect(results?.data['72166-2'].statusCode).toBe('completed');
    expect(results?.data['72166-2'].datetime).toBe('201406061032-0500');
    expect(results?.data['72166-2'].value).toBe('Ex-smoker');

    expect(results?.data['11367-0'].title).toBe('History of tobacco use');
    expect(results?.data['11367-0'].statusCode).toBe('completed');
    expect(results?.data['11367-0'].datetimeLow).toBe('1994');
    expect(results?.data['11367-0'].datetimeHigh).toBe('201103');
    expect(results?.data['11367-0'].value).toBe('Moderate cigarette smoker');
  });

  it('parses sexual orientation gender identity', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_social_history_sexual_orientation_gender_identity.xml',
        ),
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDASocialHistorySection(sections, [
      '2.16.840.1.113883.10.20.22.2.17',
    ]);

    expect(results).not.toBeNull();

    expect(results?.data['76690-7'].title).toBe('Sexual orientation');
    expect(results?.data['76690-7'].statusCode).toBe('completed');
    expect(results?.data['76690-7'].datetimeLow).toBe('2001');
    expect(results?.data['76690-7'].value).toBe('Bisexual');

    expect(results?.data['76691-5'].title).toBe('Gender identity');
    expect(results?.data['76691-5'].statusCode).toBe('completed');
    expect(results?.data['76691-5'].datetimeLow).toBe('2001');
    expect(results?.data['76691-5'].value).toBe('Female-to-male transsexual');
  });

  it('parses nested entityRelationship', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_social_history_nested_entry_relationships.xml',
        ),
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDASocialHistorySection(sections, [
      '2.16.840.1.113883.10.20.22.2.17',
    ]);

    expect(results).not.toBeNull();

    expect(results?.data['72166-2'].title).toBe('Tobacco smoking status NHIS');
    expect(results?.data['72166-2'].statusCode).toBe('completed');
    expect(results?.data['72166-2'].datetime).toBe('20220830');
    expect(results?.data['72166-2'].value).toBe('Never smoked tobacco');

    expect(results?.data['11367-0'].title).toBe('History of tobacco use');
    expect(results?.data['11367-0'].statusCode).toBe('completed');
    expect(results?.data['11367-0'].datetimeLow).toBe('');
    expect(results?.data['11367-0'].datetimeHigh).toBe('');
    expect(results?.data['11367-0'].value).toBe('Passive smoker');

    expect(results?.data['88031-0'].title).toBe('Smokeless tobacco status');
    expect(results?.data['88031-0'].statusCode).toBe('completed');
    expect(results?.data['88031-0'].datetime).toBe('20220830');
    expect(results?.data['88031-0'].value).toBe('Smokeless tobacco non-user');

    expect(results?.data['11331-6'].title).toBe('History of Alcohol Use');
    expect(results?.data['11331-6'].statusCode).toBe('completed');
    expect(results?.data['11331-6'].datetime).toBe('20230316');
    expect(results?.data['11331-6'].value).toBe(
      'Current drinker of alcohol (finding)',
    );

    expect(results?.data['8689-2'].title).toBe('History of Social function');
    expect(results?.data['8689-2'].statusCode).toBe('completed');
    expect(results?.data['8689-2'].datetime).toBe('20230316');
    expect(results?.data['8689-2'].value).toBe('');

    expect(results?.data['8689-2'].entityRelationships).not.toBeNull();
    expect(results?.data['8689-2'].entityRelationships!['88028-6'].title).toBe(
      'Tobacco use panel',
    );
    expect(results?.data['8689-2'].entityRelationships!['88028-6'].value).toBe(
      'Low Risk',
    );

    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['72166-2'].title,
    ).toBe('Tobacco smoking status NHIS');
    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['72166-2'].value,
    ).toBe('Never smoker');

    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['88031-0'].title,
    ).toBe('Smokeless tobacco status');
    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['88031-0'].value,
    ).toBe('Never used');

    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['Passive Exposure'].title,
    ).toBe('Passive Exposure');
    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['Passive Exposure'].value,
    ).toBe('Never');

    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['Passive Exposure'].title,
    ).toBe('Passive Exposure');

    expect(results?.data['8689-2'].entityRelationships!['55757-9'].title).toBe(
      'Patient Health Questionnaire 2 item (PHQ-2) [Reported]',
    );
    expect(results?.data['8689-2'].entityRelationships!['55757-9'].value).toBe(
      'Not at risk',
    );

    expect(
      results?.data['8689-2'].entityRelationships!['55757-9']
        .entityRelationships!['73831-0'].title,
    ).toBe('Adolescent depression screening assessment');
    expect(
      results?.data['8689-2'].entityRelationships!['55757-9']
        .entityRelationships!['73831-0'].value,
    ).toBe('0');
  });
});
