import {
  activeFilterCount,
  dateRangeLabel,
  filterDaysInRange,
  hasFilters,
  isDateRangeValid,
  NO_FILTERS,
  presetFrom,
  toTimelineQuery,
} from './timelineFilters';
import { RecordsByDate } from './types';

describe('timelineFilters', () => {
  const today = new Date(2026, 10, 22);

  it('turns categories into resource types and widens the date bounds by two days', () => {
    expect(
      toTimelineQuery({
        categories: ['labs', 'visits'],
        from: '2024-11-01',
        to: '2024-12-31',
      }),
    ).toEqual({
      types: ['observation', 'diagnosticreport', 'encounter'],
      dateFrom: '2024-10-30',
      dateBefore: '2025-01-03',
    });
  });

  it('covers every stored medication resource type under Medications', () => {
    expect(toTimelineQuery({ categories: ['medications'] }).types).toEqual([
      'medication',
      'medicationstatement',
      'medicationrequest',
      'medicationorder',
      'medicationdispense',
      'medicationadministration',
    ]);
  });

  it('keeps only the local days inside the range, inclusive', () => {
    const data = {
      '2024-03-01': [],
      '2024-02-29': [],
      '2024-02-01': [],
      '2024-01-31': [],
    } as RecordsByDate;

    expect(
      Object.keys(
        filterDaysInRange(data, {
          categories: [],
          from: '2024-02-01',
          to: '2024-02-29',
        }) ?? {},
      ),
    ).toEqual(['2024-02-29', '2024-02-01']);
    expect(filterDaysInRange(data, NO_FILTERS)).toBe(data);
  });

  it('rejects a From day after the To day', () => {
    expect(
      isDateRangeValid({
        categories: [],
        from: '2025-01-01',
        to: '2024-01-01',
      }),
    ).toBe(false);
    expect(
      isDateRangeValid({
        categories: [],
        from: '2024-01-01',
        to: '2024-01-01',
      }),
    ).toBe(true);
    expect(isDateRangeValid({ categories: [], from: '2025-01-01' })).toBe(true);
  });

  it('names a preset range by the preset, and any other range by its days', () => {
    expect(
      dateRangeLabel({ categories: [], from: presetFrom(2, today) }, today),
    ).toBe('Past 2 years');
    expect(dateRangeLabel({ categories: [], from: '2024-11-05' }, today)).toBe(
      'Since Nov 5, 2024',
    );
    expect(dateRangeLabel({ categories: [], to: '2024-11-20' }, today)).toBe(
      'Until Nov 20, 2024',
    );
    expect(
      dateRangeLabel(
        { categories: [], from: '2024-11-05', to: '2024-11-20' },
        today,
      ),
    ).toBe('Nov 5, 2024 – Nov 20, 2024');
    expect(dateRangeLabel(NO_FILTERS, today)).toBeUndefined();
  });

  it('counts each category and the date range once', () => {
    const filters = {
      categories: ['labs' as const],
      from: '2024-01-01',
      to: '2024-02-01',
    };
    expect(activeFilterCount(filters)).toBe(2);
    expect(hasFilters(filters)).toBe(true);
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ categories: [], to: '2024-01-01' })).toBe(true);
  });
});
