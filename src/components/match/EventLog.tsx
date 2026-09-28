import { useState } from 'react';
import type { MatchEvent, Player } from '../../types';
import { describeEvent, eventTimeLabel } from '../../lib/eventDescriptions';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';

interface EventLogProps {
  events: MatchEvent[];
  playersById: Map<string, Player>;
  formationId: string;
  canUndo: boolean;
  onUndo: () => void;
  onDeleteEvent: (eventId: string) => void;
}

export function EventLog({ events, playersById, formationId, canUndo, onUndo, onDeleteEvent }: EventLogProps) {
  const [deleteTarget, setDeleteTarget] = useState<MatchEvent | null>(null);
  const sorted = [...events].sort((a, b) => b.matchClockMs - a.matchClockMs || b.timestamp - a.timestamp);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Event log</h2>
        <Button size="sm" variant="secondary" onClick={onUndo} disabled={!canUndo}>
          Undo last action
        </Button>
      </div>
      <ol className="mt-2 max-h-96 space-y-1 overflow-y-auto">
        {sorted.length === 0 && <p className="text-sm text-slate-500">No events yet.</p>}
        {sorted.map((event) => (
          <li
            key={event.id}
            className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700"
          >
            <span className="tabular-nums text-slate-500">{eventTimeLabel(events, event)}</span>
            <span className="flex-1">{describeEvent(event, playersById, formationId)}</span>
            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(event)} aria-label="Delete event">
              ✕
            </Button>
          </li>
        ))}
      </ol>

      <Dialog
        open={!!deleteTarget}
        title="Delete this event?"
        description="Score and player statistics will be recalculated automatically. This cannot be undone."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteTarget) onDeleteEvent(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete event
            </Button>
          </>
        }
      >
        {deleteTarget && <p className="text-sm">{describeEvent(deleteTarget, playersById, formationId)}</p>}
      </Dialog>
    </div>
  );
}
