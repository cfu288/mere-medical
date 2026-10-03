import { compareDateInfoDesc, DateInfo } from './types';

const known = (iso: string): DateInfo => ({ kind: 'known', iso });

describe('compareDateInfoDesc', () => {
  it.each([
    [
      'one instant written with Z and with an offset',
      known('2025-11-10T20:39:00Z'),
      known('2025-11-10T15:39:00-05:00'),
      0,
    ],
    [
      'an offset time that is later but sorts earlier as text',
      known('2025-01-01T23:00:00-05:00'),
      known('2025-01-02T01:00:00Z'),
      -1,
    ],
    [
      'a date-only value against a time on the same day',
      known('2025-03-14'),
      known('2025-03-14T10:00:00Z'),
      1,
    ],
    ['year-only values', known('2024'), known('2025'), 1],
    [
      'milliseconds against seconds',
      known('2025-11-10T20:39:00.000Z'),
      known('2025-11-10T20:39:00Z'),
      0,
    ],
    [
      'two unparseable values fall back to text order',
      known('last spring'),
      known('next week'),
      1,
    ],
    [
      'an unparseable value sorts after a parseable one',
      known('not a date'),
      known('2025-01-01'),
      1,
    ],
    [
      'an empty value sorts after a real one',
      known(''),
      known('2025-01-01'),
      1,
    ],
    ['unknown after known', { kind: 'unknown' }, known('2025-01-01'), 1],
    ['known before unknown', known('2025-01-01'), { kind: 'unknown' }, -1],
    ['two unknowns tie', { kind: 'unknown' }, { kind: 'unknown' }, 0],
  ] as [string, DateInfo, DateInfo, number][])('%s', (_name, a, b, sign) => {
    expect(Math.sign(compareDateInfoDesc(a, b))).toEqual(sign);
  });
});
