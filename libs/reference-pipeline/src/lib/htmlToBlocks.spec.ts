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
      { kind: 'text', text: 'Updated 2026.' },
      { kind: 'heading', level: 1, text: 'Screening' },
      { kind: 'text', text: 'Screen all adults.' },
      { kind: 'heading', level: 2, text: 'Hypertension' },
      {
        kind: 'text',
        text: 'Measure blood pressure.\n\nRepeat yearly.',
      },
    ]);
  });

  it('keeps the link text of a heading and drops its target', () => {
    expect(
      htmlToBlocks('<h2><a href="/uspstf/htn">Hypertension in Adults</a></h2>'),
    ).toEqual([{ kind: 'heading', level: 2, text: 'Hypertension in Adults' }]);
  });

  it('keeps a hash line in a code block as text', () => {
    expect(
      htmlToBlocks('<h1>Real</h1><pre><code># not a heading</code></pre>'),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Real' },
      { kind: 'text', text: '```\n# not a heading\n```' },
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
      { kind: 'heading', level: 1, text: 'HIGHLIGHTS' },
      { kind: 'text', text: '*   Bleeding risk' },
      { kind: 'heading', level: 2, text: 'DOSAGE' },
      {
        kind: 'text',
        text: '5 mg twice daily\n\n1.  Weigh\n\nDaily',
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
      { kind: 'heading', level: 2, text: 'Call 911' },
      {
        kind: 'text',
        text: 'Chest pain\n\nCall your provider\n\nFever',
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
      },
    ]);
  });

  it('keeps a data table with inline code as a gfm table', () => {
    expect(
      htmlToBlocks(
        '<table><thead><tr><th>Vaccine</th><th>Dose</th></tr></thead>' +
          '<tbody><tr><td>Tdap</td><td><code>0.5 mL</code></td></tr></tbody></table>',
      ),
    ).toEqual([
      {
        kind: 'text',
        text: '| Vaccine | Dose |\n| --- | --- |\n| Tdap | `0.5 mL` |',
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
      },
    ]);
  });

  it('drops site navigation from a page with no main or article element', () => {
    expect(
      htmlToBlocks(
        '<nav><ul><li>About</li><li>Guidelines</li></ul></nav>' +
          '<h2>CKD Evaluation</h2><p>Check eGFR yearly.</p>',
      ),
    ).toEqual([
      { kind: 'heading', level: 2, text: 'CKD Evaluation' },
      { kind: 'text', text: 'Check eGFR yearly.' },
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
      },
      { kind: 'text', text: 'Screen adults aged 45 to 75.' },
    ]);
  });

  it('converts only the element with role main when the page has no main element', () => {
    expect(
      htmlToBlocks(
        '<div class="menu"><h4>Recommendations</h4><h4>News</h4></div>' +
          '<div role="main"><h1>A &amp; B Recommendations</h1><p>Screen adults for hypertension.</p></div>' +
          '<div class="menu"><h4>Recommendations</h4><h4>News</h4></div>',
      ),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'A & B Recommendations' },
      { kind: 'text', text: 'Screen adults for hypertension.' },
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
      },
      { kind: 'text', text: 'Start at 45.' },
    ]);
  });

  it('converts the whole page when it has several articles', () => {
    expect(
      htmlToBlocks(
        '<h1>News</h1><article><p>First story.</p></article><article><p>Second story.</p></article>',
      ),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'News' },
      { kind: 'text', text: 'First story.\n\nSecond story.' },
    ]);
  });

  it('drops scripts however they are typed or nested, styles, noscript fallbacks, frames and objects, and outputs nothing for embeds and templates', () => {
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
    ).toEqual([{ kind: 'text', text: 'Keep' }]);
  });

  it('keeps only the text of every link', () => {
    expect(
      htmlToBlocks(
        '<p><a href="https://www.cdc.gov/x">CDC</a> ' +
          '<a href="javascript:document.getElementById(\'x\')">Show more</a> ' +
          '<a href="#section-5">jump</a></p>',
      ),
    ).toEqual([{ kind: 'text', text: 'CDC Show more jump' }]);
  });

  it('keeps only the alt text of every image, escaped as markdown', () => {
    expect(
      htmlToBlocks(
        '<p><img src="https://www.cdc.gov/chart.png" alt="Chart [1]"> ' +
          '<img src="javascript:alert(1)" alt="Map"></p>',
      ),
    ).toEqual([{ kind: 'text', text: 'Chart \\[1\\] Map' }]);
  });
});
