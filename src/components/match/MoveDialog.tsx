import { useState } from 'react';
import type { Assignment, FormationPosition, Player } from '../../types';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';

interface MoveDialogProps {
  open: boolean;
  player: Player | null;
  positions: FormationPosition[];
  assignments: Assignment;
  playersById: Map<string, Player>;
  onClose: () => void;
  onConfirm: (toSlot: string) => void;
}

export function MoveDialog({ open, player, positions, assignments, playersById, onClose, onConfirm }: MoveDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!player) return null;

  const currentSlot = positions.find((p) => assignments[p.id] === player.id)?.id ?? 'BENCH';

  const options: { slot: string; label: string; occupantName: string | null }[] = [
    { slot: 'BENCH', label: 'Bench', occupantName: null },
    ...positions.map((p) => ({
      slot: p.id,
      label: p.label,
      occupantName: assignments[p.id] && assignments[p.id] !== player.id ? playersById.get(assignments[p.id])?.name ?? null : null,
    })),
  ];

  return (
    <Dialog
      open={open}
      title={`Move ${player.name}`}
      description="Choose a destination, then confirm."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selected || selected === currentSlot}
            onClick={() => {
              if (selected) onConfirm(selected);
              setSelected(null);
            }}
          >
            Confirm move
          </Button>
        </>
      }
    >
      <fieldset className="max-h-80 space-y-1 overflow-y-auto">
        <legend className="sr-only">Destination</legend>
        {options.map((opt) => (
          <label
            key={opt.slot}
            className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="move-destination"
                checked={selected === opt.slot}
                disabled={opt.slot === currentSlot}
                onChange={() => setSelected(opt.slot)}
              />
              {opt.label}
              {opt.slot === currentSlot && <span className="text-xs text-slate-400">(current)</span>}
            </span>
            {opt.occupantName && (
              <span className="text-xs text-slate-500 dark:text-slate-400">Swap with {opt.occupantName}</span>
            )}
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
