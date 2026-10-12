import { htmlToBlocks } from './htmlToBlocks';

describe('htmlToBlocks', () => {
  it('splits the page at its headings, at any depth, into heading and text blocks', () => {
    expect(
      htmlToBlocks(
        '<p>Updated 2026.</p>' +
          '<div><section><h1>Screening</h1><p>Screen all adults.</p>' +
          '<h2>\n  Hypertension\n</h2><p>Measure blood pressure.</p><p>Repeat yearly.</p></section></div>',
      ),
    ).toEqual([
      { kind: 'text', text: 'Updated 2026.', page: null },
      { kind: 'heading', level: 1, text: 'Screening', page: null },
      { kind: 'text', text: 'Screen all adults.', page: null },
      { kind: 'heading', level: 2, text: 'Hypertension', page: null },
      {
        kind: 'text',
        text: 'Measure blood pressure.\n\nRepeat yearly.',
        page: null,
      },
    ]);
  });

  it('keeps the link text of a heading and drops its target', () => {
    expect(
      htmlToBlocks('<h2><a href="/uspstf/htn">Hypertension in Adults</a></h2>'),
    ).toEqual([
      { kind: 'heading', level: 2, text: 'Hypertension in Adults', page: null },
    ]);
  });

  it('treats a heading that only links elsewhere on the page as text', () => {
    expect(
      htmlToBlocks(
        '<h1><a href="#s23">2.3 Missed Dose</a></h1>' +
          '<h2 id="s23">2.3 Missed Dose</h2><p>Take it the same day.</p>',
      ),
    ).toEqual([
      { kind: 'text', text: '[2.3 Missed Dose](#s23)', page: null },
      { kind: 'heading', level: 2, text: '2.3 Missed Dose', page: null },
      { kind: 'text', text: 'Take it the same day.', page: null },
    ]);
  });

  it('keeps a hash line in a code block as text', () => {
    expect(
      htmlToBlocks('<h1>Real</h1><pre><code># not a heading</code></pre>'),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Real', page: null },
      { kind: 'text', text: '```\n# not a heading\n```', page: null },
    ]);
  });

  it('keeps a data table with no headings or lists as a gfm table', () => {
    expect(
      htmlToBlocks(
        '<table><thead><tr><th>Topic</th><th>Grade</th></tr></thead>' +
          '<tbody><tr><td>Hypertension screening</td><td>A</td></tr></tbody></table>',
      ),
    ).toEqual([
      {
        kind: 'text',
        text: '| Topic | Grade |\n| --- | --- |\n| Hypertension screening | A   |',
        page: null,
      },
    ]);
  });

  it('unwraps a layout table holding headings or lists into plain blocks', () => {
    expect(
      htmlToBlocks(
        '<table><tbody><tr>' +
          '<td><h1>HIGHLIGHTS</h1><ul><li>Bleeding risk</li></ul></td>' +
          '<td><h2>DOSAGE</h2><p>5 mg twice daily</p></td>' +
          '</tr></tbody></table>' +
          '<table><tbody><tr><td><ol><li>Weigh</li></ol></td><td>Daily</td></tr></tbody></table>',
      ),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'HIGHLIGHTS', page: null },
      { kind: 'text', text: '*   Bleeding risk', page: null },
      { kind: 'heading', level: 2, text: 'DOSAGE', page: null },
      {
        kind: 'text',
        text: '5 mg twice daily\n\n1.  Weigh\n\nDaily',
        page: null,
      },
    ]);
  });

  it('converts only the main element when the page has one', () => {
    expect(
      htmlToBlocks(
        '<nav><h2>Main navigation</h2><a href="/">Home</a></nav>' +
          '<main><h1>Colorectal Cancer: Screening</h1><p>Screen adults aged 45 to 75.</p></main>' +
          '<footer><h2>About</h2></footer>',
      ),
    ).toEqual([
      {
        kind: 'heading',
        level: 1,
        text: 'Colorectal Cancer: Screening',
        page: null,
      },
      { kind: 'text', text: 'Screen adults aged 45 to 75.', page: null },
    ]);
  });

  it('finds the main element by the page structure, not by markup inside a comment', () => {
    expect(
      htmlToBlocks('<nav>Menu</nav><!-- <main> --><main><p>Body.</p></main>'),
    ).toEqual([{ kind: 'text', text: 'Body.', page: null }]);
  });

  it('converts only the article when the page has exactly one and no main element', () => {
    expect(
      htmlToBlocks(
        '<nav><h2>Main navigation</h2></nav>' +
          '<article class="ahrquspstf full"><h2>Starting and Stopping Ages</h2><p>Start at 45.</p></article>' +
          '<footer><h2>News</h2></footer>',
      ),
    ).toEqual([
      {
        kind: 'heading',
        level: 2,
        text: 'Starting and Stopping Ages',
        page: null,
      },
      { kind: 'text', text: 'Start at 45.', page: null },
    ]);
  });

  it('converts the whole page when it has several articles', () => {
    expect(
      htmlToBlocks(
        '<h1>News</h1><article><p>First story.</p></article><article><p>Second story.</p></article>',
      ),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'News', page: null },
      { kind: 'text', text: 'First story.\n\nSecond story.', page: null },
    ]);
  });

  it('drops scripts however they are typed or nested, styles, noscript fallbacks, frames, embedded objects and templates', () => {
    expect(
      htmlToBlocks(
        '<main><p>Keep</p><script>alert(1)</script><style>p{}</style>' +
          '<script type="module">import x from "y"</script>' +
          '<script type="application/ld+json">{"@type":"Drug"}</script>' +
          '<svg><script>alert(1)</script></svg>' +
          '<noscript><h2>Enable JavaScript</h2></noscript>' +
          '<iframe src="https://evil.example">frame</iframe>' +
          '<object data="x.swf">object</object><embed src="x.swf">' +
          '<template><h2>hidden</h2></template></main>',
      ),
    ).toEqual([{ kind: 'text', text: 'Keep', page: null }]);
  });

  it('keeps only the text of a link whose target is not a web, mail or relative address', () => {
    expect(
      htmlToBlocks(
        '<p><a href="javascript:alert(1)">print</a> ' +
          '<a href=" JaVaScRiPt:alert(1)">mixed case</a> ' +
          '<a href="java&#9;script:alert(1)">tab</a> ' +
          '<a href="data:text/html,hi">data</a> ' +
          '<a href="vbscript:msgbox">vb</a></p>',
      ),
    ).toEqual([
      { kind: 'text', text: 'print mixed case tab data vb', page: null },
    ]);
  });

  it('keeps web, mail and relative links', () => {
    expect(
      htmlToBlocks(
        '<p><a href="https://www.cdc.gov/x">cdc</a> ' +
          '<a href="mailto:help@example.com">mail</a> ' +
          '<a href="/vaccines/notes">notes</a> ' +
          '<a href="#section-5">jump</a></p>',
      ),
    ).toEqual([
      {
        kind: 'text',
        text: '[cdc](https://www.cdc.gov/x) [mail](mailto:help@example.com) [notes](/vaccines/notes) [jump](#section-5)',
        page: null,
      },
    ]);
  });

  it('keeps only the alt text of an image whose source is not a web or relative address', () => {
    expect(
      htmlToBlocks(
        '<p><img src="javascript:alert(1)" alt="chart"> ' +
          '<img src="https://www.cdc.gov/chart.png" alt="safe chart"></p>',
      ),
    ).toEqual([
      {
        kind: 'text',
        text: 'chart ![safe chart](https://www.cdc.gov/chart.png)',
        page: null,
      },
    ]);
  });

  it('keeps the alt text of an unsafe image as text, never as a markdown link or autolink', () => {
    expect(
      htmlToBlocks(
        '<p><img src="javascript:alert(1)" alt="[click](javascript:alert(1))"> ' +
          '<img src="javascript:alert(1)" alt="<javascript:alert(1)>"></p>',
      ),
    ).toEqual([
      {
        kind: 'text',
        text: '\\[click\\](javascript:alert(1)) \\<javascript:alert(1)>',
        page: null,
      },
    ]);
  });

  it('keeps page text that spells a link or tag as text, leaving a less-than sign before a number alone', () => {
    expect(
      htmlToBlocks(
        '<p>See &lt;javascript:alert(1)&gt; and &lt;b&gt;bold&lt;/b&gt;; aim for SBP &lt;130 mmHg</p>',
      ),
    ).toEqual([
      {
        kind: 'text',
        text: 'See \\<javascript:alert(1)> and \\<b>bold\\</b>; aim for SBP <130 mmHg',
        page: null,
      },
    ]);
  });
});
