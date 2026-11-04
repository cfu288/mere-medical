/**
 * Stands in for `window.IntersectionObserver` in specs. It never reports an
 * element as visible. Content that loads on scroll stays unloaded.
 *
 * @example
 * window.IntersectionObserver = HiddenIntersectionObserver;
 */
export const HiddenIntersectionObserver = class {
  observe() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
} as unknown as typeof IntersectionObserver;

/**
 * Stands in for `window.IntersectionObserver` in specs. It reports every
 * observed element as visible at once. Content that loads on scroll loads.
 *
 * @example
 * window.IntersectionObserver = VisibleIntersectionObserver;
 */
export const VisibleIntersectionObserver = class {
  constructor(
    private callback: (entries: { isIntersecting: boolean }[]) => void,
  ) {}
  observe() {
    this.callback([{ isIntersecting: true }]);
  }
  disconnect() {
    return undefined;
  }
} as unknown as typeof IntersectionObserver;
