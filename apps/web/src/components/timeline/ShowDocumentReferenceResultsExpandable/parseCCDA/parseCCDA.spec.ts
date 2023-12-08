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
    expect(results?.[0]?.data['94500-6'].unit).toBe(null);
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
    expect(results?.[0]?.data['42931-6'].unit).toBe(null);
    expect(results?.[0]?.data['42931-6'].datetime).toBe('201310221426-0500');
    expect(results?.[0]?.data['42931-6'].referenceRangeText).toBe(
      'A negative value is a normal result'
    );

    expect(results?.[0]?.data['60256-5'].title).toBe(
      'Neisseria gonorrhoeae rRNA [Presence] in Urine by NAA with probe detection'
    );
    expect(results?.[0]?.data['60256-5'].value).toBe('Positive');
    expect(results?.[0]?.data['60256-5'].unit).toBe(null);
    expect(results?.[0]?.data['60256-5'].datetime).toBe('201310221426-0500');
    expect(results?.[0]?.data['60256-5'].referenceRangeText).toBe(
      'A negative value is a normal result'
    );
  });

  it('parses panel with with multiple reference ranges', () => {
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
    expect(results?.[0]?.data['5048-4'].unit).toBe(null);
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
});
