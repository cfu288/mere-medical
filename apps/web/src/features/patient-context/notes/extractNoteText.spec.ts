import { extractNoteText } from './extractNoteText';

const ccdaWithHpi = `<?xml version="1.0"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <component>
    <structuredBody>
      <component>
        <section>
          <templateId root="1.3.6.1.4.1.19376.1.5.3.1.3.4"/>
          <title>History of Present Illness</title>
          <text>Chris Fu is a 32 y/o M with hypertension.</text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;

describe('extractNoteText', () => {
  it('extracts prioritized CCDA sections from xml with a charset suffix', async () => {
    expect(
      await extractNoteText('application/xml; charset=utf-8', ccdaWithHpi),
    ).toEqual({
      kind: 'text',
      format: 'ccda',
      text: '== HISTORY OF PRESENT ILLNESS ==\nChris Fu is a 32 y/o M with hypertension.',
    });
  });

  it('strips html tags', async () => {
    expect(
      await extractNoteText(
        'text/html; charset=utf-8',
        '<p>Follow up in <b>two weeks</b>.</p>',
      ),
    ).toEqual({
      kind: 'text',
      format: 'html',
      text: 'Follow up in two weeks .',
    });
  });

  it('passes plain text through', async () => {
    expect(await extractNoteText('text/plain', 'Seen and examined.')).toEqual({
      kind: 'text',
      format: 'plain',
      text: 'Seen and examined.',
    });
  });

  it('strips rtf control words and groups', async () => {
    expect(
      await extractNoteText(
        'text/rtf; charset=utf-8',
        '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\pard Patient is doing well after the procedure and follow up is scheduled in two weeks.\\par}',
      ),
    ).toEqual({
      kind: 'text',
      format: 'rtf',
      text: 'Patient is doing well after the procedure and follow up is scheduled in two weeks.',
    });
  });

  it('decodes rtf hex and unicode escapes', async () => {
    expect(
      await extractNoteText(
        'text/rtf',
        "{\\rtf1\\ansi\\pard Jos\\'e9 reports the caf\\u233? visit went well and follow up is in two weeks.\\par}",
      ),
    ).toEqual({
      kind: 'text',
      format: 'rtf',
      text: 'José reports the café visit went well and follow up is in two weeks.',
    });
  });

  it('marks short rtf output as unreadable', async () => {
    expect(await extractNoteText('text/rtf', '{\\rtf1\\ansi\\pard}')).toEqual({
      kind: 'unsupported',
      reason: 'rtf-unreadable',
    });
  });

  it('marks whitespace-only extractions as empty', async () => {
    expect(await extractNoteText('text/plain', '   \n  ')).toEqual({
      kind: 'unsupported',
      reason: 'empty',
    });
  });

  it('marks unrecognized content types as unsupported', async () => {
    expect(await extractNoteText('image/jpeg', 'xxxx')).toEqual({
      kind: 'unsupported',
      reason: 'unknown-type',
    });
  });
});
