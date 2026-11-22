import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  TimelineFilterDialog,
  TimelineFilterChips,
} from './TimelineFilterControls';
import { NO_FILTERS, TimelineFilters } from '../../timelineFilters';
import { HiddenIntersectionObserver } from '../../../../test-utils/intersectionObserver';

// jsdom has no CSS global; React Aria's popover calls CSS.escape.
globalThis.CSS ??= { escape: (s: string) => s } as unknown as typeof CSS;

function setLayout(desktop: boolean) {
  window.matchMedia = ((media: string) => ({
    matches: desktop && media === '(min-width: 640px)',
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

describe('TimelineFilterDialog', () => {
  beforeEach(() => setLayout(true));

  function openPanel(filters: TimelineFilters = NO_FILTERS) {
    const setFilters = jest.fn();
    render(<TimelineFilterDialog filters={filters} setFilters={setFilters} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Filter by type and date/ }),
    );
    return setFilters;
  }

  it('applies the chosen types and dates only when Show results is pressed', () => {
    const setFilters = openPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Labs' }));
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2024-01-01' },
    });
    expect(setFilters).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show results' }));

    expect(setFilters).toHaveBeenCalledWith({
      categories: ['labs'],
      from: '2024-01-01',
    });
  });

  it('blocks a From day after the To day', () => {
    openPanel();

    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2025-01-01' },
    });
    fireEvent.change(screen.getByLabelText('To'), {
      target: { value: '2024-01-01' },
    });

    expect(screen.getByText('From must be on or before To.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show results' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('Reset clears the draft back to no filters', () => {
    const setFilters = openPanel({ categories: ['labs'], from: '2024-01-01' });

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show results' }));

    expect(setFilters).toHaveBeenCalledWith(NO_FILTERS);
  });

  it('shows how many filters are active', () => {
    render(
      <TimelineFilterDialog
        filters={{ categories: ['labs', 'visits'], from: '2024-01-01' }}
        setFilters={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Filter by type and date, 3 active' }),
    ).toBeTruthy();
  });
});

describe('TimelineFilterDialog on mobile', () => {
  beforeEach(() => {
    setLayout(false);
    window.IntersectionObserver = HiddenIntersectionObserver;
  });

  it('applies the filters from the sheet and closes it', async () => {
    const setFilters = jest.fn();
    render(
      <TimelineFilterDialog filters={NO_FILTERS} setFilters={setFilters} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Filter by type and date/ }),
    );
    expect(document.querySelector('[data-sheet-content]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Labs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show results' }));

    expect(setFilters).toHaveBeenCalledWith({ categories: ['labs'] });
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Filter records' }),
      ).toBeNull(),
    );
  });
});

describe('TimelineFilterChips', () => {
  const filters: TimelineFilters = {
    categories: ['labs', 'visits'],
    from: '2024-11-05',
  };

  it('renders nothing without filters', () => {
    const { container } = render(
      <TimelineFilterChips filters={NO_FILTERS} setFilters={jest.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('removes one filter per chip and all of them with Clear', () => {
    const setFilters = jest.fn();
    render(<TimelineFilterChips filters={filters} setFilters={setFilters} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Labs' }));
    expect(setFilters).toHaveBeenLastCalledWith({
      ...filters,
      categories: ['visits'],
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Since Nov 5, 2024' }),
    );
    expect(setFilters).toHaveBeenLastCalledWith({
      categories: ['labs', 'visits'],
      from: undefined,
      to: undefined,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(setFilters).toHaveBeenLastCalledWith(NO_FILTERS);
  });
});
