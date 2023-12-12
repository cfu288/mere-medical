import { parseDateString } from './parseCCDA';
import crypto from 'crypto';
Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: crypto.webcrypto.subtle,
  },
});
import fs from 'fs';
import path from 'path';
import { parseCCDAResultsSection } from './parseCCDAResultsSection';
import { parseCCDASocialHistorySection } from './parseCCDASocialHistorySection';
import exp from 'constants';
/**
 * effectiveTime use in C-CDA Entries

This is an abstracted universal definition of effectiveTime in C-CDA documents:
Per the RIM, the effectiveTime, also referred to as the “biologically relevant time,” is the time at which the act holds for the patient. (C-CDA 2.1, pg 22)

@value - Use this when the event (i.e. encounter, assessment, measurement or administration) only occurred at a single point in time
low/@value - Use this when the target act starts, or will start, at a point in time and could end in the future (known or unknown). If C-CDA only includes an effectiveTime/low it means the 'act' is ongoing and active.
high/@value - 
Use this when the target act starts at a point in time and could end. 
Omit <high> element to indicate act is ongoing (prefered). If your system must include a high element, use high/@nullFlavor=”NA” (Not Applicable). 
Use nullFlavor=”UNK” if act has ended If it has ended, and the end time is unknown
Do NOT use nullFlavor=”UNK” when you aren’t certain if the act has ended. Omit the element or use nullFlavor=”NI” (No information).

In general, we do not recommend use of other elements (e.g. <center>, <width> or <period>) within effectiveTime with the exception of the use of <period> for medication administration schedules.

Only include known specificity. For example, if you only know a person’s birthday to day, only include to day effectiveTime/@value=”20121111”. Do not pad out time with zeros.

When reporting time it is best practice to include a timezone offset. effectiveTime/@value=20140104123506-0500" 

If specificity to seconds is not available - either of these patterns is possible. Some systems will always send the additional zeros whether significant or not:
 effectiveTime/@value=201401041235-0500"  
 effectiveTime/@value=20140104123500-0500" 

When time zone is not specified the time SHALL be interpreted as local, not UTC. To indicate the time zone of UTC include +0000.
 
Time Zone in United States
UTC Offset Standard Time
UTC Offset Daylight Saving Time
Eastern
UTC - 0500
UTC - 0400
Central
UTC - 0600
UTC - 0500
Mountain
UTC - 0700
UTC - 0600
Pacific
UTC - 0800
UTC - 0700


 */

describe('parseDateString', () => {
  it('should parse timestamp yyyyMMdd', () => {
    const date = parseDateString('20121113');
    const expectedLocalDate = new Date(2012, 10, 13).toLocaleString();
    expect(date).toBe(expectedLocalDate);
  });
  it('should parse timestamp yyyyMMddHH', () => {
    const date = parseDateString('2012111301');
    const expectedLocalDate = new Date(2012, 10, 13, 1).toLocaleString();
    expect(date).toBe(expectedLocalDate);
  });
  it('should parse timestamp yyyyMMddHHmm', () => {
    const date = parseDateString('201211130101');
    const expectedLocalDate = new Date(2012, 10, 13, 1, 1).toLocaleString();
    expect(date).toBe(expectedLocalDate);
  });
  it('should parse timestamp yyyyMMddHHmmss', () => {
    const date = parseDateString('20121113010101');
    const expectedLocalDate = new Date(2012, 10, 13, 1, 1, 1).toLocaleString();
    expect(date).toBe(expectedLocalDate);
  });
  it('should parse timestamp yyyyMMddHHmmssxx', () => {
    const date = parseDateString('20121113010102-0000');
    const expectedLocalDate = new Date(2012, 10, 12, 20, 1, 2).toLocaleString();
    expect(date).toBe(expectedLocalDate);
  });
  it('should parse timestamp 20230314161700+0000 ', () => {
    // 20230314161700+0000 should translate to 03/14/2023 1217 EDT
    const date = parseDateString('20230314161700+0000');
    const expectedLocalDate = new Date(2023, 2, 14, 12, 17, 0).toLocaleString();
    expect(date).toBe(expectedLocalDate);
  });
});

describe('parseCCDAResultsSection', () => {
  it('parses covid result positive section', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(__dirname, './exampleCCDA/example_result_covid_positive.xml')
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe(
      'SARS-CoV-2 (COVID-19) RNA panel - Respiratory specimen by NAA with probe detection'
    );

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('202003221426-0500')).toBe(true);

    expect(results?.[0]?.data['94500-6'].title).toBe(
      'SARS-CoV-2 (COVID-19) RNA [Presence] in Respiratory specimen by NAA with probe detection'
    );
    expect(results?.[0]?.data['94500-6'].value).toBe('Detected');
    expect(results?.[0]?.data['94500-6'].unit).toBe('');
    expect(results?.[0]?.data['94500-6'].datetime).toBe('202003221426-0500');
    expect(results?.[0]?.data['94500-6'].referenceRangeText).toBe(
      'Reference (Normal) for this test is not detected'
    );
  });

  it('parses panel with coded values of negative-positive', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_result_panel_with_coded_values_of_negative_positive.xml'
        )
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe(
      'Chlamydia trachomatis and Neisseria gonorrhoeae rRNA panel - Urine by NAA with probe detection'
    );

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('201310221426-0500')).toBe(true);

    expect(results?.[0]?.data['42931-6'].title).toBe(
      'Chlamydia trachomatis rRNA [Presence] in Urine by NAA with probe detection'
    );
    expect(results?.[0]?.data['42931-6'].value).toBe('Negative');
    expect(results?.[0]?.data['42931-6'].unit).toBe('');
    expect(results?.[0]?.data['42931-6'].datetime).toBe('201310221426-0500');
    expect(results?.[0]?.data['42931-6'].referenceRangeText).toBe(
      'A negative value is a normal result'
    );

    expect(results?.[0]?.data['60256-5'].title).toBe(
      'Neisseria gonorrhoeae rRNA [Presence] in Urine by NAA with probe detection'
    );
    expect(results?.[0]?.data['60256-5'].value).toBe('Positive');
    expect(results?.[0]?.data['60256-5'].unit).toBe('');
    expect(results?.[0]?.data['60256-5'].datetime).toBe('201310221426-0500');
    expect(results?.[0]?.data['60256-5'].referenceRangeText).toBe(
      'A negative value is a normal result'
    );
  });

  it('parses result with with multiple reference ranges', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_result_with_multiple_reference_ranges.xml'
        )
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe(
      'Nuclear Ab [Titer] in Serum by Immunofluorescence'
    );

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('201703191230-0800')).toBe(true);

    expect(results?.[0]?.data['5048-4'].title).toBe(
      'Nuclear Ab [Titer] in Serum by Immunofluorescence'
    );
    expect(results?.[0]?.data['5048-4'].value).toBe(
      'Borderline, equal to 1:80'
    );
    expect(results?.[0]?.data['5048-4'].unit).toBe('');
    expect(results?.[0]?.data['5048-4'].datetime).toBe('201703191230-0800');
    expect(results?.[0]?.data['5048-4'].referenceRangeText).toBe(
      'Negative, less than 1:80'
    );
    expect(results?.[0]?.data['5048-4'].referenceRangeTextItems.length).toBe(3);
    expect(results?.[0]?.data['5048-4'].referenceRangeTextItems).toContain(
      'Borderline, equal to 1:80'
    );
    expect(results?.[0]?.data['5048-4'].referenceRangeTextItems).toContain(
      'Negative, less than 1:80'
    );
    expect(results?.[0]?.data['5048-4'].referenceRangeTextItems).toContain(
      'Positive, greater than 1:80'
    );
  });

  it('parses result with an unstructured string as value urine color', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_result_with_an_unstructured_string_as_value.xml'
        )
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe('Urinalysis complete pnl Ur');

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('20131023090823-0500')).toBe(true);

    expect(results?.[0]?.data['5778-6'].title).toBe('Color of Urine');
    expect(results?.[0]?.data['5778-6'].value).toBe('Amber');
    expect(results?.[0]?.data['5778-6'].unit).toBe('');
    expect(results?.[0]?.data['5778-6'].datetime).toBe('20131023090823-0500');
    expect(results?.[0]?.data['5778-6'].referenceRangeText).toBe('');
    expect(results?.[0]?.data['5778-6'].referenceRangeTextItems.length).toBe(0);
  });

  it('parses results radiology with image narrative', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_results_radiology_with_image_narrative.xml'
        )
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe('Chest X-Ray 2 Views');

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('20150225091059-0500')).toBe(true);

    expect(results?.[0]?.data['36643-5'].title).toBe('XR Chest 2 Views');
    expect(results?.[0]?.data['36643-5'].value!.replace(/\s+/g, ' ')).toBe(
      `The lungs are clear. The heart is enlarged with evidence of
                                        cardiomegaly.
                                        Pulmonary vasculature is normal. The aorta is mildly ectatic and
                                        tortuous.
                                        IMPRESSION: Cardiomegaly. No other acute abnormality.`.replace(
        /\s+/g,
        ' '
      )
    );
    expect(results?.[0]?.data['36643-5'].unit).toBe('');
    expect(results?.[0]?.data['36643-5'].datetime).toBe('20150225091059-0500');
    expect(results?.[0]?.data['36643-5'].referenceRangeText).toBe('');
    expect(results?.[0]?.data['36643-5'].referenceRangeTextItems.length).toBe(
      0
    );
  });
});

describe('parseCCDASocialHistorySection', () => {
  it('parses former smoking status', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_social_history_former_smoking_status.xml'
        )
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
          './exampleCCDA/example_social_history_sexual_orientation_gender_identity.xml'
        )
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
          './exampleCCDA/example_social_history_nested_entry_relationships.xml'
        )
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDASocialHistorySection(sections, [
      '2.16.840.1.113883.10.20.22.2.17',
    ]);

    expect(results).not.toBeNull();

    // expect(results?.data['72166-2'].title).toBe('Tobacco smoking status NHIS');
    // expect(results?.data['72166-2'].statusCode).toBe('completed');
    // expect(results?.data['72166-2'].datetime).toBe('20220830');
    // expect(results?.data['72166-2'].value).toBe('Never smoked tobacco');

    // expect(results?.data['11367-0'].title).toBe('History of tobacco use');
    // expect(results?.data['11367-0'].statusCode).toBe('completed');
    // expect(results?.data['11367-0'].datetimeLow).toBe('');
    // expect(results?.data['11367-0'].datetimeHigh).toBe('');
    // expect(results?.data['11367-0'].value).toBe('Passive smoker');

    // expect(results?.data['88031-0'].title).toBe('Smokeless tobacco status');
    // expect(results?.data['88031-0'].statusCode).toBe('completed');
    // expect(results?.data['88031-0'].datetime).toBe('20220830');
    // expect(results?.data['88031-0'].value).toBe('Smokeless tobacco non-user');

    // expect(results?.data['11331-6'].title).toBe('History of Alcohol Use');
    // expect(results?.data['11331-6'].statusCode).toBe('completed');
    // expect(results?.data['11331-6'].datetime).toBe('20230316');
    // expect(results?.data['11331-6'].value).toBe(
    //   'Current drinker of alcohol (finding)'
    // );

    expect(results?.data['8689-2'].title).toBe('History of Social function');
    expect(results?.data['8689-2'].statusCode).toBe('completed');
    expect(results?.data['8689-2'].datetime).toBe('20230316');
    expect(results?.data['8689-2'].value).toBe('');

    expect(results?.data['8689-2'].entityRelationships).not.toBeNull();
    expect(results?.data['8689-2'].entityRelationships!['88028-6'].title).toBe(
      'Tobacco use panel'
    );
    expect(results?.data['8689-2'].entityRelationships!['88028-6'].value).toBe(
      'Low Risk'
    );

    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['72166-2'].title
    ).toBe('Tobacco smoking status NHIS');
    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['72166-2'].value
    ).toBe('Never smoker');

    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['88031-0'].title
    ).toBe('Smokeless tobacco status');
    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['88031-0'].value
    ).toBe('Never used');

    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['Passive Exposure'].title
    ).toBe('Passive Exposure');
    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['Passive Exposure'].value
    ).toBe('Never');

    expect(
      results?.data['8689-2'].entityRelationships!['88028-6']
        .entityRelationships!['Passive Exposure'].title
    ).toBe('Passive Exposure');

    expect(results?.data['8689-2'].entityRelationships!['55757-9'].title).toBe(
      'Patient Health Questionnaire 2 item (PHQ-2) [Reported]'
    );
    expect(results?.data['8689-2'].entityRelationships!['55757-9'].value).toBe(
      'Not at risk'
    );

    expect(
      results?.data['8689-2'].entityRelationships!['55757-9']
        .entityRelationships!['73831-0'].title
    ).toBe('Adolescent depression screening assessment');
    expect(
      results?.data['8689-2'].entityRelationships!['55757-9']
        .entityRelationships!['73831-0'].value
    ).toBe('0');
  });
});
