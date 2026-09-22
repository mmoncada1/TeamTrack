import type { Player } from '../../types';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { formatClock } from '../../lib/timer';

interface SubstitutionConfirmDialogProps {
  open: boolean;
  playerIn: Player | null;
  playerOut: Player | null;
  positionLabel: string;
  matchClockMs: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubstitutionConfirmDialog({
  open,
  playerIn,
  playerOut,
  positionLabel,
  matchClockMs,
  onConfirm,
  onCancel,
}: SubstitutionConfirmDialogProps) {
  if (!playerIn || !playerOut) return null;
  return (
    <Dialog
      open={open}
      title="Confirm substitution"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Confirm substitution
          </Button>
        </>
      }
    >
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500 dark:text-slate-400">Player in</dt>
          <dd className="font-semibold">{playerIn.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500 dark:text-slate-400">Player out</dt>
          <dd className="font-semibold">{playerOut.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500 dark:text-slate-400">Position</dt>
          <dd>{positionLabel}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500 dark:text-slate-400">Match time</dt>
          <dd className="tabular-nums">{formatClock(matchClockMs)}</dd>
        </div>
      </dl>
    </Dialog>
  );
}
