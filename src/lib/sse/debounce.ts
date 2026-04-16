/**
 * Lightweight debounce utility.
 *
 * Used by the SSE client and hook to batch rapid incoming events before
 * flushing to React state — prevents flicker on burst updates (P3-08 requirement:
 * 100 ms visual batching window).
 *
 * No external dependencies; native timer only.
 */

/**
 * Returns a debounced version of `fn` that delays invocation by `waitMs`
 * after the last call.  The returned function also exposes a `.flush()`
 * method to invoke `fn` immediately and cancel the pending timer, and a
 * `.cancel()` method to cancel without invoking.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): ((...args: Args) => void) & { flush: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Args | undefined;

  function invoke(): void {
    if (lastArgs !== undefined) {
      fn(...lastArgs);
      lastArgs = undefined;
    }
  }

  function debounced(...args: Args): void {
    lastArgs = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      invoke();
    }, waitMs);
  }

  debounced.flush = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    invoke();
  };

  debounced.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    lastArgs = undefined;
  };

  return debounced;
}
