import type { MatchStatus } from '../types';

/**
 * Timestamp-based match clock.
 *
 * The match clock is NEVER derived from `setInterval` tick counts. Instead
 * every render/computation re-derives elapsed time from:
 *   - `clockOffsetMs`: accumulated elapsed match time up to the last pause
 *   - `clockRunningSince`: the real `Date.now()` timestamp when the clock was
 *     last started or resumed (or `null` while paused/stopped)
 *
 * This means the clock is always correct after tab suspension, device
 * sleep, or a full page reload/reopen: we simply re-read `Date.now()` and
 * recompute, we never "lose" or "double count" time.
 */

export interface ClockLike {
  status: MatchStatus;
  clockRunningSince: number | null;
  clockOffsetMs: number;
}

export function isClockRunning(match: ClockLike): boolean {
  return match.status === 'in_progress' && match.clockRunningSince != null;
}

export function getMatchClockMs(match: ClockLike, nowMs: number = Date.now()): number {
  if (isClockRunning(match)) {
    return match.clockOffsetMs + Math.max(0, nowMs - (match.clockRunningSince as number));
  }
  return match.clockOffsetMs;
}

export type ClockPatch = ClockLike;

/** Start the clock fresh (match kickoff). */
export function startClock(nowMs: number = Date.now()): ClockPatch {
  return { status: 'in_progress', clockRunningSince: nowMs, clockOffsetMs: 0 };
}

/** Freeze the clock at its current elapsed value. */
export function pauseClock(match: ClockLike, nowMs: number = Date.now()): ClockPatch {
  return {
    status: 'paused',
    clockRunningSince: null,
    clockOffsetMs: getMatchClockMs(match, nowMs),
  };
}

/** Resume a paused clock without losing previously accumulated time. */
export function resumeClock(match: ClockLike, nowMs: number = Date.now()): ClockPatch {
  return {
    status: 'in_progress',
    clockRunningSince: nowMs,
    clockOffsetMs: match.clockOffsetMs,
  };
}

/** Freeze the clock for half-time (same mechanics as pause, distinct status). */
export function haltForHalfTime(match: ClockLike, nowMs: number = Date.now()): ClockPatch {
  return {
    status: 'half_time',
    clockRunningSince: null,
    clockOffsetMs: getMatchClockMs(match, nowMs),
  };
}

/** Stop the clock permanently at match end. */
export function endClock(match: ClockLike, nowMs: number = Date.now()): ClockPatch {
  return {
    status: 'ended',
    clockRunningSince: null,
    clockOffsetMs: getMatchClockMs(match, nowMs),
  };
}

/** Format milliseconds as `M:SS` (or `H:MM:SS` past an hour). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

export function msToMinutes(ms: number): number {
  return ms / 60000;
}

export function minutesToMs(minutes: number): number {
  return minutes * 60000;
}
