import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

function mockMediaQuery(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = (() => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: 'change', l: () => void) => listeners.add(l),
    removeEventListener: (_: 'change', l: () => void) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia;
  return {
    set(value: boolean) {
      matches = value;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}

describe('useMediaQuery', () => {
  it('reports the query and follows changes', () => {
    const media = mockMediaQuery(true);
    const { result, unmount } = renderHook(() =>
      useMediaQuery('(min-width: 640px)'),
    );

    expect(result.current).toBe(true);
    act(() => media.set(false));
    expect(result.current).toBe(false);

    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
