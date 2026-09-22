import type { MatchStatus } from '../../types';
import { formatClock } from '../../lib/timer';
import { Button } from '../common/Button';

interface MatchClockProps {
  matchClockMs: number;
  status: MatchStatus;
  currentHalf: 1 | 2;
  halfLengthMinutes: number;
  numberOfHalves: 1 | 2;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onHalfTime: () => void;
  onEnd: () => void;
}

const STATUS_LABEL: Record<MatchStatus, string> = {
  setup: 'Not started',
  in_progress: 'Live',
  paused: 'Paused',
  half_time: 'Half-time',
  ended: 'Ended',
};

export function MatchClock({
  matchClockMs,
  status,
  currentHalf,
  halfLengthMinutes,
  numberOfHalves,
  onStart,
  onPause,
  onResume,
  onHalfTime,
  onEnd,
}: MatchClockProps) {
  const halfLengthMs = halfLengthMinutes * 60000;
  const pastHalfLength = numberOfHalves === 2 && status === 'in_progress' && matchClockMs >= halfLengthMs;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div>
        <div className="text-2xl font-bold tabular-nums" aria-live="off">
          {formatClock(matchClockMs)}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              status === 'in_progress' ? 'bg-emerald-500' : status === 'paused' ? 'bg-amber-500' : 'bg-slate-400'
            }`}
            aria-hidden
          />
          <span>
            {STATUS_LABEL[status]}
            {numberOfHalves === 2 && status !== 'half_time' ? ` · Half ${currentHalf}` : ''}
          </span>
          {status === 'half_time' && <span>Clock reset for the second half</span>}
          {pastHalfLength && <span className="font-medium text-amber-600">Past half length</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Match clock controls">
        {status === 'setup' && (
          <Button variant="primary" size="sm" onClick={onStart}>
            Start match
          </Button>
        )}
        {status === 'in_progress' && (
          <>
            <Button variant="secondary" size="sm" onClick={onPause}>
              Pause
            </Button>
            {numberOfHalves === 2 && currentHalf === 1 && (
              <Button variant="secondary" size="sm" onClick={onHalfTime}>
                Half-time
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={onEnd}>
              End match
            </Button>
          </>
        )}
        {status === 'paused' && (
          <>
            <Button variant="primary" size="sm" onClick={onResume}>
              Resume
            </Button>
            <Button variant="danger" size="sm" onClick={onEnd}>
              End match
            </Button>
          </>
        )}
        {status === 'half_time' && (
          <>
            <Button variant="primary" size="sm" onClick={onResume}>
              Start second half
            </Button>
            <Button variant="danger" size="sm" onClick={onEnd}>
              End match
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
