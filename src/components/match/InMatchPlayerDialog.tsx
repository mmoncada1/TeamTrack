import { useEffect, useState } from 'react';
import type { Player, PlayerRuntimeState } from '../../types';
import type { PlayerFormInput } from '../../state/rosterStore';
import type { FieldError } from '../../lib/validation';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { PlayerForm } from '../roster/PlayerForm';

interface InMatchPlayerDialogProps {
  player: Player | null;
  state: PlayerRuntimeState | undefined;
  requireGender?: boolean;
  onClose: () => void;
  onMarkInjured: () => void;
  onReturnToBench: () => void;
  onRemove: () => void;
  onSaveDetails: (input: PlayerFormInput) => Promise<{ errors: FieldError[] }>;
}

export function InMatchPlayerDialog({
  player,
  state,
  requireGender,
  onClose,
  onMarkInjured,
  onReturnToBench,
  onRemove,
  onSaveDetails,
}: InMatchPlayerDialogProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);

  useEffect(() => {
    setConfirmRemove(false);
    setEditingDetails(false);
  }, [player?.id]);

  if (!player) return null;
  const out = state?.status === 'unavailable';

  return (
    <Dialog
      open
      title={player.name}
      description="Double-click a player any time during the match."
      onClose={onClose}
    >
      {confirmRemove ? (
        <div className="space-y-3">
          <p className="text-sm">
            Remove {player.name} from this match. Minutes already played stay on the summary.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              Back
            </Button>
            <Button variant="danger" onClick={onRemove}>
              Remove from match
            </Button>
          </div>
        </div>
      ) : editingDetails ? (
        <PlayerForm
          initial={player}
          requireGender={requireGender}
          submitLabel="Save"
          onCancel={() => setEditingDetails(false)}
          onSubmit={async (input) => {
            const result = await onSaveDetails(input);
            if (result.errors.length === 0) setEditingDetails(false);
            return result;
          }}
        />
      ) : (
        <div className="space-y-2">
          {out ? (
            <Button variant="primary" className="w-full" onClick={onReturnToBench}>
              Return to bench
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={onMarkInjured}>
              Mark injured
            </Button>
          )}
          <Button variant="secondary" className="w-full" onClick={() => setEditingDetails(true)}>
            Edit name and position
          </Button>
          <Button variant="danger" className="w-full" onClick={() => setConfirmRemove(true)}>
            Remove from match
          </Button>
        </div>
      )}
    </Dialog>
  );
}
