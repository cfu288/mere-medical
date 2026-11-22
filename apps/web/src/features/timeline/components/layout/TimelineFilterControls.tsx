import { useReducer } from 'react';
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
  NO_FILTERS,
  presetFrom,
  TIMELINE_CATEGORIES,
  TimelineCategoryKey,
  TimelineFilters,
} from '../../timelineFilters';
import { useMediaQuery } from '../../../../shared/hooks/useMediaQuery';

const pill =
  'inline-flex items-center gap-2 h-9 px-3 rounded-full border text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';
const pillOff =
  'border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
const pillOn =
  'border-primary-500 bg-primary-50 text-primary-900 dark:border-primary-300 dark:bg-primary-900 dark:text-primary-50';

type DraftAction =
  | { type: 'TOGGLE_CATEGORY'; key: TimelineCategoryKey }
  | { type: 'SET_DATE_PRESET'; from: string | undefined }
  | { type: 'SET_DATE'; field: 'from' | 'to'; value: string | undefined }
  | { type: 'RESET' };

function draftReducer(
  state: TimelineFilters,
  action: DraftAction,
): TimelineFilters {
  switch (action.type) {
    case 'TOGGLE_CATEGORY':
      return {
        ...state,
        categories: state.categories.includes(action.key)
          ? state.categories.filter((k) => k !== action.key)
          : [...state.categories, action.key],
      };

    case 'SET_DATE_PRESET':
      return { ...state, from: action.from, to: undefined };

    case 'SET_DATE':
      return { ...state, [action.field]: action.value };

    case 'RESET':
      return NO_FILTERS;

    default:
      return state;
  }
}

function FilterPanel({
  value,
  onApply,
  close,
}: {
  value: TimelineFilters;
  onApply: (f: TimelineFilters) => void;
  close: () => void;
}) {
  const [draft, dispatch] = useReducer(draftReducer, value);
  const rangeValid = !draft.from || !draft.to || draft.from <= draft.to;

  return (
    <div className="flex flex-col gap-5 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between">
        <Heading slot="title" className="text-lg font-bold">
          Filter records
        </Heading>
        <button
          type="button"
          onClick={() => dispatch({ type: 'RESET' })}
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
                onClick={() =>
                  dispatch({ type: 'TOGGLE_CATEGORY', key: c.key })
                }
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
                key={p.label}
                type="button"
                aria-pressed={on}
                onClick={() => dispatch({ type: 'SET_DATE_PRESET', from })}
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
                  dispatch({
                    type: 'SET_DATE',
                    field: k,
                    value: e.target.value || undefined,
                  })
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

export function TimelineFilterDialog({
  filters,
  setFilters,
}: {
  filters: TimelineFilters;
  setFilters: (f: TimelineFilters) => void;
}) {
  const isDesktop = useMediaQuery('(min-width: 640px)');
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

export function TimelineFilterChips({
  filters,
  setFilters,
}: {
  filters: TimelineFilters;
  setFilters: (f: TimelineFilters) => void;
}) {
  const dateLabel = dateRangeLabel(filters);
  const chips = [
    ...TIMELINE_CATEGORIES.filter((c) =>
      filters.categories.includes(c.key),
    ).map((c) => ({
      label: c.label,
      icon: (
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${c.dot}`} />
      ),
      remove: {
        categories: filters.categories.filter((k) => k !== c.key),
      },
    })),
    ...(dateLabel
      ? [
          {
            label: dateLabel,
            icon: <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />,
            remove: { from: undefined, to: undefined },
          },
        ]
      : []),
  ];
  if (!chips.length) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex min-w-0 flex-grow gap-1.5 overflow-x-auto">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            aria-label={`Remove ${chip.label}`}
            className="flex-none inline-flex items-center gap-1.5 h-9 pl-2.5 pr-1.5 rounded-full border border-primary-200 bg-primary-50 text-primary-900 text-[13px] font-semibold dark:border-primary-700 dark:bg-primary-900 dark:text-primary-50"
            onClick={() => setFilters({ ...filters, ...chip.remove })}
          >
            {chip.icon}
            {chip.label}
            <XMarkIcon
              className="h-3.5 w-3.5 text-primary-700 dark:text-primary-200"
              aria-hidden="true"
            />
          </button>
        ))}
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
