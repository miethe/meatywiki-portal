/**
 * Unit tests for src/lib/sse/debounce.ts
 */

import { debounce } from "@/lib/sse/debounce";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("debounce", () => {
  it("delays invocation until after the wait period", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced("a");
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("resets the timer on repeated calls", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    jest.advanceTimersByTime(50);
    debounced("second");
    jest.advanceTimersByTime(50);
    // only 50 ms past the second call — should not have fired
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("second");
  });

  it("flush() calls the function immediately and cancels the timer", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced("queued");
    debounced.flush();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("queued");

    // Advancing the timer should NOT call fn again
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("flush() is a no-op if nothing is queued", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced.flush(); // nothing queued yet
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel() discards the queued call", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced("will-be-cancelled");
    debounced.cancel();

    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it("works with multiple arguments", () => {
    const fn = jest.fn<void, [string, number]>();
    const debounced = debounce(fn, 50);

    debounced("hello", 42);
    jest.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledWith("hello", 42);
  });
});
