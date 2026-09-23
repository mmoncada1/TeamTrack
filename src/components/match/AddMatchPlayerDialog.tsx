import { useEffect, useState } from 'react';
import type { Player } from '../../types';
import type { PlayerFormInput } from '../../state/rosterStore';
import type { FieldError } from '../../lib/validation';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { PlayerForm } from '../roster/PlayerForm';
import { jerseyLabel } from '../../lib/playerSort';

interface AddMatchPlayerDialogProps {
  open: boolean;
  players: Player[];
  requireGender?: boolean;
  onClose: () => void;
  onAdd: (playerId: string) => void;
  onCreate: (input: PlayerFormInput) => Promise<{ errors: FieldError[] }>;
}

export function AddMatchPlayerDialog({
  open,
  players,
  requireGender,
  onClose,
  onAdd,
  onCreate,
}: AddMatchPlayerDialogProps) {
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) setCreating(false);
  }, [open]);

  return (
    <Dialog open={open} title="Add player" description="They start on the bench from now." onClose={onClose}>
      {creating ? (
        <PlayerForm
          requireGender={requireGender}
          submitLabel="Add to match"
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            const result = await onCreate(input);
            if (result.errors.length === 0) setCreating(false);
            return result;
          }}
        />
      ) : (
        <div className="space-y-3">
          {players.length === 0 ? (
            <p className="text-sm text-slate-500">Everyone on the roster is already in this match.</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {players.map((player) => (
                <li key={player.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-semibold">{jerseyLabel(player.jerseyNumber)}</span> {player.name}
                  </span>
                  <Button size="sm" variant="primary" onClick={() => onAdd(player.id)}>
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" className="w-full" onClick={() => setCreating(true)}>
            New player
          </Button>
        </div>
      )}
    </Dialog>
  );
}
