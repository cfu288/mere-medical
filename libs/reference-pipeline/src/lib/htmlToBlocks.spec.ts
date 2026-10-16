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

  it('unwraps a table holding headings or lists into plain blocks', () => {
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

  it('unwraps a table holding a heading that also has header cells', () => {
    expect(
      htmlToBlocks(
        '<table><tr><td><h2>Call 911</h2></td><td>Chest pain</td></tr>' +
          '<tr><th>Call your provider</th><td>Fever</td></tr></table>',
      ),
    ).toEqual([
      { kind: 'heading', level: 2, text: 'Call 911', page: null },
      {
        kind: 'text',
        text: 'Chest pain\n\nCall your provider\n\nFever',
        page: null,
      },
    ]);
  });

  it('unwraps a table holding a quote, rule or code block', () => {
    expect(
      htmlToBlocks(
        '<table><tr><td><blockquote>Quote</blockquote></td><td>a<hr>b</td>' +
          '<td><pre><code>x = 1</code></pre></td></tr></table>',
      ),
    ).toEqual([
      {
        kind: 'text',
        text: '> Quote\n\na\n\n* * *\n\nb\n\n```\nx = 1\n```',
        page: null,
      },
    ]);
  });

  it('keeps the caption of an unwrapped table before its cells', () => {
    expect(
      htmlToBlocks(
        '<table><caption>Adults 18 and older</caption><tr><td><ul><li>Screen yearly</li></ul></td></tr></table>',
      ),
    ).toEqual([
      {
        kind: 'text',
        text: 'Adults 18 and older\n\n*   Screen yearly',
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

  it('keeps only the text of every link', () => {
    expect(
      htmlToBlocks(
        '<p><a href="https://www.cdc.gov/x">CDC</a> ' +
          '<a href="javascript:document.getElementById(\'x\')">Show more</a> ' +
          '<a href="#section-5">jump</a></p>',
      ),
    ).toEqual([{ kind: 'text', text: 'CDC Show more jump', page: null }]);
  });

  it('keeps only the alt text of every image, escaped as markdown', () => {
    expect(
      htmlToBlocks(
        '<p><img src="https://www.cdc.gov/chart.png" alt="Chart [1]"> ' +
          '<img src="javascript:alert(1)" alt="Map"></p>',
      ),
    ).toEqual([{ kind: 'text', text: 'Chart \\[1\\] Map', page: null }]);
  });
});
