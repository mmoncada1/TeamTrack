import { useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';

interface GoalEditItem {
  id: string;
  label: string;
}

interface GoalEditMenuProps {
  open: boolean;
  onClose: () => void;
  goals: GoalEditItem[];
  onEdit: (eventId: string) => void;
  onAdd: () => void;
  onRemove: (eventId: string) => void;
  description?: string;
}

/** One place to add, change, or remove every goal in a match. */
export function GoalEditMenu({
  open,
  onClose,
  goals,
  onEdit,
  onAdd,
  onRemove,
  description = 'Add a goal, or change the scorer, assist, and time.',
}: GoalEditMenuProps) {
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setPendingRemoveId(null);
  }, [open]);

  return (
    <Dialog
      open={open}
      title="Edit goals"
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
          <Button variant="primary" onClick={onAdd}>
            Add goal
          </Button>
        </>
      }
    >
      {goals.length === 0 ? (
        <p className="text-sm text-slate-500">No goals yet.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700"
            >
              <span className="min-w-0 flex-1">{goal.label}</span>
              {pendingRemoveId === goal.id ? (
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-xs text-slate-500">Remove this goal?</span>
                  <Button size="sm" variant="ghost" onClick={() => setPendingRemoveId(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      onRemove(goal.id);
                      setPendingRemoveId(null);
                    }}
                  >
                    Remove goal
                  </Button>
                </span>
              ) : (
                <span className="flex shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(goal.id)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingRemoveId(goal.id)}>
                    Remove
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
