import { useState } from 'react';
import type { Player } from '../../types';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import type { RecordGoalInput } from '../../lib/matchActions';
import { jerseyLabel } from '../../lib/playerSort';

interface GoalDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: RecordGoalInput) => void;
  activePlayers: Player[];
  benchPlayers: Player[];
  title?: string;
  submitLabel?: string;
  initialKind?: GoalKind;
  initialScorerId?: string;
  initialAssisterId?: string;
  /** Ask for the half and minute. Used when correcting a finished match. */
  showClock?: boolean;
  showSecondHalf?: boolean;
  initialHalf?: 1 | 2;
  initialMinutes?: number;
  initialSeconds?: number;
  toMatchClockMs?: (half: 1 | 2, minutes: number, seconds: number) => number;
}

export type GoalKind = 'team' | 'opponent' | 'own';

export function goalKindFromEvent(event: { isOwnGoal: boolean; team: 'us' | 'opponent' }): GoalKind {
  if (event.isOwnGoal) return 'own';
  return event.team === 'opponent' ? 'opponent' : 'team';
}

function clampWhole(value: string, max?: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return max == null ? parsed : Math.min(max, parsed);
}

export function GoalDialog({
  open,
  onClose,
  onSubmit,
  activePlayers,
  benchPlayers,
  title = 'Record goal',
  submitLabel = 'Save goal',
  initialKind = 'team',
  initialScorerId = '',
  initialAssisterId = '',
  showClock = false,
  showSecondHalf = false,
  initialHalf = 1,
  initialMinutes = 0,
  initialSeconds = 0,
  toMatchClockMs,
}: GoalDialogProps) {
  const [kind, setKind] = useState<GoalKind>(initialKind);
  const [scorerId, setScorerId] = useState(initialScorerId);
  const [assisterId, setAssisterId] = useState(initialAssisterId);
  const [half, setHalf] = useState<1 | 2>(initialHalf);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [seconds, setSeconds] = useState(initialSeconds);
  const [error, setError] = useState<string | null>(null);

  const allSelectable = [...activePlayers, ...benchPlayers.filter((b) => !activePlayers.some((a) => a.id === b.id))];

  function reset() {
    setKind(initialKind);
    setScorerId(initialScorerId);
    setAssisterId(initialAssisterId);
    setHalf(initialHalf);
    setMinutes(initialMinutes);
    setSeconds(initialSeconds);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (kind === 'team' && !scorerId) {
      setError('Select the scorer.');
      return;
    }
    if (scorerId && assisterId && scorerId === assisterId) {
      setError('The scorer and assister cannot be the same player.');
      return;
    }
    const matchClockMs = showClock && toMatchClockMs ? toMatchClockMs(half, minutes, seconds) : undefined;
    onSubmit({
      team: kind === 'opponent' ? 'opponent' : 'us',
      isOwnGoal: kind === 'own',
      scorerId: kind === 'team' ? scorerId : kind === 'own' ? scorerId || undefined : undefined,
      assisterId: kind === 'team' ? assisterId || undefined : undefined,
      ...(matchClockMs != null ? { matchClockMs } : {}),
    });
    handleClose();
  }

  return (
    <Dialog
      open={open}
      title={title}
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="text-sm font-medium">Goal type</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {(
              [
                ['team', 'Our goal'],
                ['opponent', 'Opponent goal'],
                ['own', 'Own goal (against us)'],
              ] as [GoalKind, string][]
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="goal-kind" checked={kind === value} onChange={() => setKind(value)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {kind !== 'opponent' && (
          <div>
            <label htmlFor="scorer" className="block text-sm font-medium">
              {kind === 'own' ? 'Player responsible (optional)' : 'Scorer'}
            </label>
            <select id="scorer" className="input mt-1" value={scorerId} onChange={(e) => setScorerId(e.target.value)}>
              <option value="">{kind === 'own' ? '— Not recorded —' : '— Select scorer —'}</option>
              {allSelectable.map((p) => (
                <option key={p.id} value={p.id}>
                  {jerseyLabel(p.jerseyNumber)} {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {kind === 'team' && (
          <div>
            <label htmlFor="assister" className="block text-sm font-medium">
              Assist (optional)
            </label>
            <select id="assister" className="input mt-1" value={assisterId} onChange={(e) => setAssisterId(e.target.value)}>
              <option value="">— No assist —</option>
              {allSelectable.map((p) => (
                <option key={p.id} value={p.id}>
                  {jerseyLabel(p.jerseyNumber)} {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {showClock && (
          <fieldset>
            <legend className="text-sm font-medium">Match clock</legend>
            <div className={`mt-1 grid gap-3 ${showSecondHalf ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {showSecondHalf && (
                <label className="block text-sm">
                  Half
                  <select
                    className="input mt-1"
                    value={half}
                    onChange={(e) => setHalf(e.target.value === '2' ? 2 : 1)}
                  >
                    <option value={1}>1st half</option>
                    <option value={2}>2nd half</option>
                  </select>
                </label>
              )}
              <label className="block text-sm">
                Minutes
                <input
                  className="input mt-1"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(clampWhole(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                Seconds
                <input
                  className="input mt-1"
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={seconds}
                  onChange={(e) => setSeconds(clampWhole(e.target.value, 59))}
                />
              </label>
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
