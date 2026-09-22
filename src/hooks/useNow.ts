import { useEffect, useRef, useState } from 'react';

/**
 * Re-renders the calling component roughly every `intervalMs`, returning the
 * current `Date.now()`. Used to drive live-updating clocks/timers. Because
 * all time math is timestamp-based (see `src/lib/timer.ts`), missed ticks
 * (tab backgrounded, device asleep) never cause drift — the next tick just
 * recomputes from the real elapsed wall-clock time.
 */
export function useNow(intervalMs = 500, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    // Also resync immediately when the tab regains visibility/focus.
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [intervalMs, active]);

  return now;
}
