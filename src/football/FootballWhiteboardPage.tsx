import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { useTeamStore } from '../state/teamStore';
import { FootballField } from './FootballField';
import { DrawingToolbar } from '../drawing/DrawingToolbar';
import { useHistory } from '../drawing/useHistory';
import type { Drawing, DrawingTool } from '../drawing/types';

export function FootballWhiteboardPage() {
  const teamId = useTeamStore((s) => s.activeTeamId);
  const board = useLiveQuery(
    async () => (teamId ? ((await db.footballWhiteboards.get(teamId)) ?? null) : null),
    [teamId],
  );
  if (!teamId || board === undefined) return <p className="p-4">Loading whiteboard…</p>;
  return <Board key={teamId} teamId={teamId} initial={board?.drawings ?? []} />;
}
function Board({ teamId, initial }: { teamId: string; initial: Drawing[] }) {
  const history = useHistory(initial);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [ink, setInk] = useState('#facc15');
  const [message, setMessage] = useState('');
  const drawings = history.value;
  useEffect(() => {
    let active = true;
    db.footballWhiteboards
      .put({ id: teamId, teamId, drawings, updatedAt: Date.now() })
      .then(() => {
        if (active) setMessage('Saved on this device.');
      })
      .catch(() => {
        if (active)
          setMessage('Could not save whiteboard. Your drawing is still available in this session.');
      });
    return () => {
      active = false;
    };
  }, [teamId, drawings]);
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Football whiteboard</h1>
      <p className="text-sm text-slate-500">
        A blank tactical field, saved separately from your plays.
      </p>
      <DrawingToolbar
        tool={tool}
        onTool={setTool}
        color={ink}
        onColor={setInk}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        undo={() => history.undo()}
        redo={() => history.redo()}
        clear={() => history.change([])}
      />
      <FootballField
        drawings={drawings}
        onDrawings={(next) => history.change(next, false)}
        onGestureStart={history.checkpoint}
        tool={tool}
        ink={ink}
      />
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
