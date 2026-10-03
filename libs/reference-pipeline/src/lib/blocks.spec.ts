import { markdownToBlocks } from './blocks';

describe('markdownToBlocks', () => {
  it('turns atx headings into heading blocks and the text between into text blocks', () => {
    expect(
      markdownToBlocks(
        '# Screening\n\nScreen all adults.\n\n## Hypertension\n\nMeasure blood pressure.\nRepeat yearly.',
      ),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Screening' },
      { kind: 'text', text: 'Screen all adults.' },
      { kind: 'heading', level: 2, text: 'Hypertension' },
      { kind: 'text', text: 'Measure blood pressure.\nRepeat yearly.' },
    ]);
  });

  it('keeps text before the first heading as a text block', () => {
    expect(markdownToBlocks('Intro line.\n\n# First')).toEqual([
      { kind: 'text', text: 'Intro line.' },
      { kind: 'heading', level: 1, text: 'First' },
    ]);
  });

  it('keeps the link text of a heading and drops its target', () => {
    expect(
      markdownToBlocks('## [Hypertension in Adults](/uspstf/htn)'),
    ).toEqual([{ kind: 'heading', level: 2, text: 'Hypertension in Adults' }]);
  });

  it('treats a heading that only links elsewhere on the page as text', () => {
    expect(
      markdownToBlocks(
        '# [2.3 Missed Dose](#s23)\n\n## 2.3 Missed Dose\n\nTake it the same day.',
      ),
    ).toEqual([
      { kind: 'text', text: '[2.3 Missed Dose](#s23)' },
      { kind: 'heading', level: 2, text: '2.3 Missed Dose' },
      { kind: 'text', text: 'Take it the same day.' },
    ]);
  });

  it('treats a hash line inside a fenced block as text', () => {
    expect(markdownToBlocks('# Real\n\n```\n# not a heading\n```')).toEqual([
      { kind: 'heading', level: 1, text: 'Real' },
      { kind: 'text', text: '```\n# not a heading\n```' },
    ]);
  });
});
