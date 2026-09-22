import { describe, expect, it } from 'vitest';
import { endClock, formatClock, getMatchClockMs, haltForHalfTime, isClockRunning, pauseClock, resumeClock, startClock } from './timer';

describe('timer', () => {
  it('starts at zero and accumulates while running', () => {
    const t0 = 1_000_000;
    const clock = startClock(t0);
    expect(clock.status).toBe('in_progress');
    expect(getMatchClockMs(clock, t0)).toBe(0);
    expect(getMatchClockMs(clock, t0 + 5000)).toBe(5000);
  });

  it('freezes elapsed time on pause and does not advance while paused', () => {
    const t0 = 1_000_000;
    let clock = startClock(t0);
    clock = pauseClock(clock, t0 + 10_000);
    expect(clock.status).toBe('paused');
    expect(clock.clockOffsetMs).toBe(10_000);
    expect(isClockRunning(clock)).toBe(false);
    // Time passing while paused must not change the elapsed value.
    expect(getMatchClockMs(clock, t0 + 60_000)).toBe(10_000);
  });

  it('resumes without losing previously accumulated time', () => {
    const t0 = 1_000_000;
    let clock = startClock(t0);
    clock = pauseClock(clock, t0 + 10_000);
    clock = resumeClock(clock, t0 + 50_000); // 40s pass while paused, must not count
    expect(getMatchClockMs(clock, t0 + 50_000)).toBe(10_000);
    expect(getMatchClockMs(clock, t0 + 55_000)).toBe(15_000);
  });

  it('supports multiple pause/resume cycles accurately', () => {
    const t0 = 0;
    let clock = startClock(t0);
    clock = pauseClock(clock, 5000); // 5s elapsed
    clock = resumeClock(clock, 20_000); // 15s paused, not counted
    clock = pauseClock(clock, 25_000); // +5s => 10s elapsed
    clock = resumeClock(clock, 100_000); // long pause, not counted
    expect(getMatchClockMs(clock, 130_000)).toBe(10_000 + 30_000);
  });

  it('models a page refresh: reconstructing from persisted fields yields the same result', () => {
    let clock = startClock(0);
    clock = pauseClock(clock, 12_000);
    clock = resumeClock(clock, 20_000);
    // Simulate "page refresh": clock persisted fields are read back, and we recompute using a later `now`.
    const persisted = { ...clock };
    expect(getMatchClockMs(persisted, 28_000)).toBe(20_000);
  });

  it('halts for half-time and freezes correctly', () => {
    const t0 = 0;
    let clock = startClock(t0);
    clock = haltForHalfTime(clock, 15_000);
    expect(clock.status).toBe('half_time');
    expect(getMatchClockMs(clock, 100_000)).toBe(15_000);
  });

  it('ends the clock permanently', () => {
    let clock = startClock(0);
    clock = endClock(clock, 30_000);
    expect(clock.status).toBe('ended');
    expect(getMatchClockMs(clock, 999_999)).toBe(30_000);
  });

  it('formats clock values as M:SS and H:MM:SS', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(3_600_000 + 61_000)).toBe('1:01:01');
  });
});
