import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Popover,
  Sheet,
  SheetBackdrop,
  SheetContent,
  SheetOverlay,
  SheetTrigger,
} from 'react-aria-components';
import {
  AdjustmentsHorizontalIcon,
  CalendarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  activeFilterCount,
  DATE_PRESETS,
  dateRangeLabel,
  hasFilters,
  isDateRangeValid,
  NO_FILTERS,
  presetFrom,
  TIMELINE_CATEGORIES,
  TimelineCategoryKey,
  TimelineFilters,
} from '../../timelineFilters';

// Matches the md breakpoint where the bottom tab bar gives way to the side nav.
const DESKTOP_QUERY = '(min-width: 768px)';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia?.(DESKTOP_QUERY).matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.(DESKTOP_QUERY);
    if (!media) return;
    const onChange = () => setIsDesktop(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

const pill =
  'inline-flex items-center gap-2 h-9 px-3 rounded-full border text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';
const pillOff =
  'border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
const pillOn =
  'border-primary-500 bg-primary-50 text-primary-900 dark:border-primary-300 dark:bg-primary-900 dark:text-primary-50';

function FilterPanel({
  value,
  onApply,
  close,
}: {
  value: TimelineFilters;
  onApply: (f: TimelineFilters) => void;
  close: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const rangeValid = isDateRangeValid(draft);
  const toggle = (key: TimelineCategoryKey) =>
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(key)
        ? d.categories.filter((k) => k !== key)
        : [...d.categories, key],
    }));

  return (
    <div className="flex flex-col gap-5 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between">
        <Heading slot="title" className="text-lg font-bold">
          Filter records
        </Heading>
        <button
          type="button"
          onClick={() => setDraft(NO_FILTERS)}
          className="min-h-[44px] px-2 text-sm font-semibold text-primary-600 dark:text-primary-300"
        >
          Reset
        </button>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Type
        </legend>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_CATEGORIES.map((c) => {
            const on = draft.categories.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.key)}
                className={`${pill} ${on ? pillOn : pillOff}`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${c.dot}`}
                />
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Date
        </legend>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((p) => {
            const from = presetFrom(p.years);
            const on = !draft.to && draft.from === from;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                onClick={() => setDraft((d) => ({ ...d, from, to: undefined }))}
                className={`${pill} ${on ? pillOn : pillOff}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(['from', 'to'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1 text-sm font-medium">
              {k === 'from' ? 'From' : 'To'}
              <input
                type="date"
                aria-invalid={k === 'to' && !rangeValid}
                aria-describedby={
                  k === 'to' && !rangeValid
                    ? 'timeline-filter-range-error'
                    : undefined
                }
                value={draft[k] ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [k]: e.target.value || undefined }))
                }
                className="h-11 rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
              />
            </label>
          ))}
        </div>
        {rangeValid ? null : (
          <p
            id="timeline-filter-range-error"
            className="mt-2 text-sm text-red-700 dark:text-red-400"
          >
            From must be on or before To.
          </p>
        )}
      </fieldset>

      <button
        type="button"
        disabled={!rangeValid}
        onClick={() => {
          onApply(draft);
          close();
        }}
        className="h-11 w-full rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
      >
        Show results
      </button>
    </div>
  );
}

/** Filter button that sits inside the search field. */
export function TimelineFilterButton({
  filters,
  setFilters,
}: {
  filters: TimelineFilters;
  setFilters: (f: TimelineFilters) => void;
}) {
  const isDesktop = useIsDesktop();
  const count = activeFilterCount(filters);
  const trigger = (
    <Button
      aria-label={
        count
          ? `Filter by type and date, ${count} active`
          : 'Filter by type and date'
      }
      className={`relative flex h-11 w-11 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        count
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-100'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      <AdjustmentsHorizontalIcon className="h-6 w-6" aria-hidden="true" />
      {count ? (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-500 px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </Button>
  );
  const panel = ({ close }: { close: () => void }) => (
    <FilterPanel value={filters} onApply={setFilters} close={close} />
  );

  if (isDesktop) {
    return (
      <DialogTrigger>
        {trigger}
        <Popover
          placement="bottom end"
          offset={8}
          className="w-[440px] max-w-[calc(100vw-32px)] rounded-lg border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <Dialog className="outline-none">{panel}</Dialog>
        </Popover>
      </DialogTrigger>
    );
  }

  return (
    <SheetTrigger>
      {trigger}
      <SheetOverlay className="z-50">
        <SheetBackdrop
          className="bg-black/40"
          swipeAnimation="timeline-sheet-backdrop"
        />
        <Sheet
          overscrollPadding
          className="rounded-t-2xl bg-white shadow-xl dark:bg-gray-900"
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1.5 w-10 flex-none rounded-full bg-gray-300 dark:bg-gray-600"
          />
          <SheetContent className="max-h-[85dvh] overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 outline-none">
            {panel}
          </SheetContent>
        </Sheet>
      </SheetOverlay>
    </SheetTrigger>
  );
}

/** Removable chips for the applied filters; renders nothing with no filters. */
export function TimelineFilterChips({
  filters,
  setFilters,
}: {
  filters: TimelineFilters;
  setFilters: (f: TimelineFilters) => void;
}) {
  if (!hasFilters(filters)) return null;
  const dateLabel = dateRangeLabel(filters);
  const chip =
    'flex-none inline-flex items-center gap-1.5 h-9 pl-2.5 pr-1.5 rounded-full border border-primary-200 bg-primary-50 text-primary-900 text-[13px] font-semibold dark:border-primary-700 dark:bg-primary-900 dark:text-primary-50';
  const x = (
    <XMarkIcon
      className="h-3.5 w-3.5 text-primary-700 dark:text-primary-200"
      aria-hidden="true"
    />
  );

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex min-w-0 flex-grow gap-1.5 overflow-x-auto">
        {TIMELINE_CATEGORIES.filter((c) =>
          filters.categories.includes(c.key),
        ).map((c) => (
          <button
            key={c.key}
            type="button"
            aria-label={`Remove ${c.label}`}
            className={chip}
            onClick={() =>
              setFilters({
                ...filters,
                categories: filters.categories.filter((k) => k !== c.key),
              })
            }
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${c.dot}`}
            />
            {c.label}
            {x}
          </button>
        ))}
        {dateLabel ? (
          <button
            type="button"
            aria-label={`Remove ${dateLabel}`}
            className={chip}
            onClick={() =>
              setFilters({ ...filters, from: undefined, to: undefined })
            }
          >
            <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {dateLabel}
            {x}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setFilters(NO_FILTERS)}
        className="min-h-[44px] flex-none px-2 text-[13px] font-semibold text-primary-600 dark:text-primary-300"
      >
        Clear
      </button>
    </div>
  );
}
