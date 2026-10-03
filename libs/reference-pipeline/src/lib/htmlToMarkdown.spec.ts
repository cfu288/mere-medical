import { htmlToMarkdown } from './htmlToMarkdown';

describe('htmlToMarkdown', () => {
  it('keeps table structure as a gfm table', () => {
    expect(
      htmlToMarkdown(
        '<table><thead><tr><th>Topic</th><th>Grade</th></tr></thead>' +
          '<tbody><tr><td>Hypertension screening</td><td>A</td></tr></tbody></table>',
      ),
    ).toEqual(
      '| Topic | Grade |\n| --- | --- |\n| Hypertension screening | A   |',
    );
  });

  it('converts only the main element when the page has one', () => {
    expect(
      htmlToMarkdown(
        '<nav><h2>Main navigation</h2><a href="/">Home</a></nav>' +
          '<main><h1>Colorectal Cancer: Screening</h1><p>Screen adults aged 45 to 75.</p></main>' +
          '<footer><h2>About</h2></footer>',
      ),
    ).toEqual('# Colorectal Cancer: Screening\n\nScreen adults aged 45 to 75.');
  });

  it('converts only the article when the page has exactly one and no main element', () => {
    expect(
      htmlToMarkdown(
        '<nav><h2>Main navigation</h2></nav>' +
          '<article class="ahrquspstf full"><h2>Starting and Stopping Ages</h2><p>Start at 45.</p></article>' +
          '<footer><h2>News</h2></footer>',
      ),
    ).toEqual('## Starting and Stopping Ages\n\nStart at 45.');
  });

  it('converts the whole page when it has several articles', () => {
    expect(
      htmlToMarkdown(
        '<h1>News</h1><article><p>First story.</p></article><article><p>Second story.</p></article>',
      ),
    ).toEqual('# News\n\nFirst story.\n\nSecond story.');
  });

  it('unwraps a layout table holding headings or lists into plain blocks', () => {
    expect(
      htmlToMarkdown(
        '<table><tbody><tr>' +
          '<td><h1>HIGHLIGHTS</h1><ul><li>Bleeding risk</li></ul></td>' +
          '<td><h2>DOSAGE</h2><p>5 mg twice daily</p></td>' +
          '</tr></tbody></table>',
      ),
    ).toEqual(
      '# HIGHLIGHTS\n\n*   Bleeding risk\n\n## DOSAGE\n\n5 mg twice daily',
    );
  });

  it('drops scripts and styles', () => {
    expect(
      htmlToMarkdown('<p>Keep</p><script>alert(1)</script><style>p{}</style>'),
    ).toEqual('Keep');
  });
});
