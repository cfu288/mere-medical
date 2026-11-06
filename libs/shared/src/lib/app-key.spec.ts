import { parseAppKey } from './app-key';

describe('parseAppKey', () => {
  it.each([
    [
      'a generated key',
      'Qm1tdHJ3b3h3b3h3b3h3b3h3b3h3b3h3',
      { status: 'ok', key: 'Qm1tdHJ3b3h3b3h3b3h3b3h3b3h3b3h3' },
    ],
    [
      'surrounding whitespace',
      '  0123456789abcdef0123456789abcdef \n',
      { status: 'ok', key: '0123456789abcdef0123456789abcdef' },
    ],
    ['undefined', undefined, { status: 'missing' }],
    ['an empty string', '', { status: 'missing' }],
    ['only whitespace', '   ', { status: 'missing' }],
    ['an unsubstituted placeholder', '$APP_KEY', { status: 'missing' }],
    [
      'thirty-one characters',
      '0123456789abcdef0123456789abcde',
      { status: 'wrong-format' },
    ],
    [
      'thirty-three characters',
      '0123456789abcdef0123456789abcdef0',
      { status: 'wrong-format' },
    ],
    [
      'a space inside',
      '0123456789abcdef 123456789abcdef',
      { status: 'wrong-format' },
    ],
    [
      'punctuation',
      '0123456789abcdef!123456789abcdef',
      { status: 'wrong-format' },
    ],
    [
      'an accented letter',
      'clé456789abcdef0123456789abcdef',
      { status: 'wrong-format' },
    ],
    [
      'an emoji',
      'valid-app-key-for-the-test-sui🔑',
      { status: 'wrong-format' },
    ],
  ])('parses %s', (_name, input, expected) => {
    expect(parseAppKey(input)).toEqual(expected);
  });
});
