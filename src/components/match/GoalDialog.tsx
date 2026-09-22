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
}

type GoalKind = 'team' | 'opponent' | 'own';

export function GoalDialog({ open, onClose, onSubmit, activePlayers, benchPlayers }: GoalDialogProps) {
  const [kind, setKind] = useState<GoalKind>('team');
  const [scorerId, setScorerId] = useState('');
  const [assisterId, setAssisterId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allSelectable = [...activePlayers, ...benchPlayers.filter((b) => !activePlayers.some((a) => a.id === b.id))];

  function reset() {
    setKind('team');
    setScorerId('');
    setAssisterId('');
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
    onSubmit({
      team: kind === 'opponent' ? 'opponent' : 'us',
      isOwnGoal: kind === 'own',
      scorerId: kind === 'team' ? scorerId : kind === 'own' ? scorerId || undefined : undefined,
      assisterId: kind === 'team' ? assisterId || undefined : undefined,
    });
    handleClose();
  }

  return (
    <Dialog
      open={open}
      title="Record goal"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Save goal
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

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
