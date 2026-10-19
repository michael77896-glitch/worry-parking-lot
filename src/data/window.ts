/**
 * Worry window math. Pure functions with no imports, so they are easy to test.
 *
 * The window is a daily span of local wall-clock time: it opens at `startMinutes`
 * after local midnight and stays open for `lengthMinutes`. A window may run past
 * midnight. Everything uses the device's current local time zone.
 */

export type WindowSettings = {
  /** Minutes after local midnight when the window opens (0 to 1439). */
  startMinutes: number;
  /** How long the window stays open, in minutes. */
  lengthMinutes: number;
};

export type WindowSpan = { opensAt: Date; closesAt: Date };

export const MIN_WINDOW_LENGTH = 5;
export const MAX_WINDOW_LENGTH = 180;

export const DEFAULT_WINDOW: WindowSettings = { startMinutes: 19 * 60, lengthMinutes: 15 };

const MINUTE_MS = 60_000;

/** The window that opens on the local calendar day `dayOffset` days from `from`. */
function windowOnDay(from: Date, dayOffset: number, s: WindowSettings): WindowSpan {
  const opensAt = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + dayOffset,
    Math.floor(s.startMinutes / 60),
    s.startMinutes % 60,
  );
  return { opensAt, closesAt: new Date(opensAt.getTime() + s.lengthMinutes * MINUTE_MS) };
}

// --- Test window (development builds only) -------------------------------------------------
// Lets a developer open the gate by hand without waiting for the real window. It is compiled
// out of release builds: outside development, `setTestWindow` does nothing, so it can never
// be used to read a locked worry early.

const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__;

let testWindow: WindowSpan | null = null;

/** Opens the gate for `minutes` starting now, or closes the test window when `minutes` is null. */
export function setTestWindow(minutes: number | null, now: Date = new Date()): void {
  if (!IS_DEV) return;
  testWindow = minutes === null ? null : { opensAt: now, closesAt: new Date(now.getTime() + minutes * MINUTE_MS) };
}

function activeTestWindow(now: Date): WindowSpan | null {
  return testWindow && testWindow.opensAt <= now && now < testWindow.closesAt ? testWindow : null;
}

/** True while a hand-opened test window is in effect. */
export function isTestWindowActive(now: Date = new Date()): boolean {
  return activeTestWindow(now) !== null;
}

/** The window that is open at `now`, or null. Checks yesterday's too, for windows past midnight. */
export function currentWindow(now: Date, s: WindowSettings): WindowSpan | null {
  const test = activeTestWindow(now);
  if (test) return test;
  for (const offset of [-1, 0]) {
    const span = windowOnDay(now, offset, s);
    if (span.opensAt <= now && now < span.closesAt) return span;
  }
  return null;
}

export function isWindowOpen(now: Date, s: WindowSettings): boolean {
  return currentWindow(now, s) !== null;
}

/** The first time the window opens strictly after `after`. */
export function nextWindowOpen(after: Date, s: WindowSettings): Date {
  for (const offset of [0, 1, 2]) {
    const { opensAt } = windowOnDay(after, offset, s);
    if (opensAt > after) return opensAt;
  }
  // Unreachable: offset 1 is always later than `after`.
  throw new Error('Could not find the next worry window');
}

/**
 * The earliest moment a worry can be read: `now` if the window is open and the worry's
 * unlock time has passed, otherwise the next window opening at or after its unlock time.
 */
export function readableAt(unlocksAt: Date, now: Date, s: WindowSettings): Date {
  if (activeTestWindow(now)) return now;
  if (unlocksAt <= now && isWindowOpen(now, s)) return now;
  const from = unlocksAt > now ? unlocksAt : now;
  return nextWindowOpen(new Date(from.getTime() - 1), s);
}

export function validateWindow(s: WindowSettings): void {
  if (!Number.isInteger(s.startMinutes) || s.startMinutes < 0 || s.startMinutes > 1439) {
    throw new RangeError('Window start must be a whole number of minutes from 0 to 1439');
  }
  if (
    !Number.isInteger(s.lengthMinutes) ||
    s.lengthMinutes < MIN_WINDOW_LENGTH ||
    s.lengthMinutes > MAX_WINDOW_LENGTH
  ) {
    throw new RangeError(
      `Window length must be a whole number of minutes from ${MIN_WINDOW_LENGTH} to ${MAX_WINDOW_LENGTH}`,
    );
  }
}
