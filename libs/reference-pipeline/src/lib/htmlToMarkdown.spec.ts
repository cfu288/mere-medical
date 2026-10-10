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

  it('drops scripts however they are typed or nested', () => {
    expect(
      htmlToMarkdown(
        '<main><p>Keep</p><script type="module">import x from "y"</script>' +
          '<script type="application/ld+json">{"@type":"Drug"}</script>' +
          '<svg><script>alert(1)</script></svg></main>',
      ),
    ).toEqual('Keep');
  });

  it('drops noscript fallbacks, frames, embedded objects and templates', () => {
    expect(
      htmlToMarkdown(
        '<p>Keep</p><noscript>Enable JavaScript to view this page</noscript>' +
          '<iframe src="https://evil.example">frame</iframe>' +
          '<object data="x.swf">object</object><embed src="x.swf">' +
          '<template><p>hidden</p></template>',
      ),
    ).toEqual('Keep');
  });

  it('keeps only the text of a link whose target is not a web, mail or relative address', () => {
    expect(
      htmlToMarkdown(
        '<p><a href="javascript:alert(1)">print</a> ' +
          '<a href=" JaVaScRiPt:alert(1)">mixed case</a> ' +
          '<a href="java&#9;script:alert(1)">tab</a> ' +
          '<a href="data:text/html,hi">data</a> ' +
          '<a href="vbscript:msgbox">vb</a></p>',
      ),
    ).toEqual('print mixed case tab data vb');
  });

  it('keeps web, mail and relative links', () => {
    expect(
      htmlToMarkdown(
        '<p><a href="https://www.cdc.gov/x">cdc</a> ' +
          '<a href="mailto:help@example.com">mail</a> ' +
          '<a href="/vaccines/notes">notes</a> ' +
          '<a href="#section-5">jump</a></p>',
      ),
    ).toEqual(
      '[cdc](https://www.cdc.gov/x) [mail](mailto:help@example.com) [notes](/vaccines/notes) [jump](#section-5)',
    );
  });

  it('keeps only the alt text of an image whose source is not a web or relative address', () => {
    expect(
      htmlToMarkdown(
        '<p><img src="javascript:alert(1)" alt="chart"> ' +
          '<img src="https://www.cdc.gov/chart.png" alt="safe chart"></p>',
      ),
    ).toEqual('chart ![safe chart](https://www.cdc.gov/chart.png)');
  });

  it('keeps the alt text of an unsafe image as text, never as markdown', () => {
    expect(
      htmlToMarkdown(
        '<p><img src="javascript:alert(1)" alt="[click](javascript:alert(1))"></p>',
      ),
    ).toEqual('\\[click\\](javascript:alert(1))');
  });

  it('keeps the alt text of an unsafe image that spells an autolink as text', () => {
    expect(
      htmlToMarkdown(
        '<p><img src="javascript:alert(1)" alt="<javascript:alert(1)>"></p>',
      ),
    ).toEqual('\\<javascript:alert(1)>');
  });

  it('keeps page text that spells a link or tag as text, leaving a less-than sign before a number alone', () => {
    expect(
      htmlToMarkdown(
        '<p>See &lt;javascript:alert(1)&gt; and &lt;b&gt;bold&lt;/b&gt;; aim for SBP &lt;130 mmHg</p>',
      ),
    ).toEqual(
      'See \\<javascript:alert(1)> and \\<b>bold\\</b>; aim for SBP <130 mmHg',
    );
  });
});
