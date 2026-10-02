import { useState } from 'react';
import type { Player } from '../types';
import type {
  BallAction,
  BallActionType,
  FootballPlay,
  FootballPlayerAssignment,
  RouteType,
} from './types';
import { FootballField } from './FootballField';
import { ROUTE_LABELS, flipRoute, makeRoute, resizeRoute, rotateRoute } from './routes';
import { saveFormation, savePlay } from './repository';
import { Button } from '../components/common/Button';
import { DrawingToolbar } from '../drawing/DrawingToolbar';
import type { DrawingTool } from '../drawing/types';
import { useHistory } from '../drawing/useHistory';
import { createId } from '../lib/id';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { autofillFromRoster } from './domain';

export function FootballEditor({
  initial,
  roster,
  formationOnly = false,
  onClose,
}: {
  initial: FootballPlay;
  roster: Player[];
  formationOnly?: boolean;
  onClose: () => void;
}) {
  const history = useHistory(initial);
  const draft = history.value;
  const [selectedId, setSelectedId] = useState(draft.players[2].id);
  const [tool, setTool] = useState<DrawingTool>('select');
  const [ink, setInk] = useState('#facc15');
  const [editPath, setEditPath] = useState<'route' | 'motion' | undefined>();
  const [targetActionId, setTargetActionId] = useState<string>();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(draft) !== saved;
  const selected = draft.players.find((p) => p.id === selectedId)!;
  const autofilled = autofillFromRoster(draft, roster);
  const assignedCount = draft.players.filter((p) => p.rosterPlayerId).length;
  const fillCount = autofilled.players.filter((p) => p.rosterPlayerId).length - assignedCount;
  useUnsavedChanges(dirty);
  function updatePlayer(patch: Partial<FootballPlayerAssignment>) {
    history.change({
      ...draft,
      players: draft.players.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)),
    });
    setMessage('');
  }
  function designate(role: 'quarterbackId' | 'snapperId', id: string) {
    const other = role === 'quarterbackId' ? 'snapperId' : 'quarterbackId';
    const updated = {
      ...draft,
      [role]: id,
      [other]: draft[other] === id ? draft[role] : draft[other],
    };
    updated.ballActions = updated.ballActions.map((a) =>
      a.type === 'snap'
        ? { ...a, fromPlayerId: updated.snapperId, toPlayerId: updated.quarterbackId }
        : a,
    );
    history.change(updated);
  }
  async function save() {
    setSaving(true);
    setMessage('');
    try {
      if (formationOnly) {
        await saveFormation({
          id: draft.id,
          teamId: draft.teamId,
          name: draft.name,
          side: draft.side,
          players: draft.players,
          quarterbackId: draft.quarterbackId,
          snapperId: draft.snapperId,
          createdAt: draft.createdAt,
          updatedAt: Date.now(),
        });
      } else await savePlay(draft);
      setSaved(JSON.stringify(draft));
      setMessage('Saved on this device.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save.');
    }
    setSaving(false);
  }
  function editAction(id: string, patch: Partial<BallAction>) {
    history.change({
      ...draft,
      ballActions: draft.ballActions.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }
  function reorderAction(index: number, direction: number) {
    const actions = [...draft.ballActions].sort((a, b) => a.order - b.order);
    const to = index + direction;
    if (to < 1 || to >= actions.length) return;
    const [a] = actions.splice(index, 1);
    actions.splice(to, 0, a);
    history.change({ ...draft, ballActions: actions.map((a, order) => ({ ...a, order })) });
  }
  const slotOptions = draft.players.map((p) => (
    <option key={p.id} value={p.id}>
      {p.label}
      {p.rosterPlayerId
        ? ` — ${roster.find((player) => player.id === p.rosterPlayerId)?.name ?? 'Assigned player'}`
        : ''}
    </option>
  ));
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{formationOnly ? 'Formation editor' : 'Play editor'}</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (!dirty || window.confirm('Discard unsaved edits?')) onClose();
            }}
          >
            Back
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : formationOnly ? 'Save formation' : 'Save play'}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {formationOnly ? 'Formation name' : 'Play name'}
          <input
            className="input mt-1"
            value={draft.name}
            onChange={(e) => history.change({ ...draft, name: e.target.value })}
          />
        </label>
        {!formationOnly && (
          <label className="text-sm font-medium">
            Tags (comma separated)
            <input
              className="input mt-1"
              value={draft.tags.join(', ')}
              onChange={(e) =>
                history.change({ ...draft, tags: e.target.value.split(',').map((t) => t.trim()) })
              }
            />
          </label>
        )}
      </div>
      {!formationOnly && (
        <label className="block text-sm font-medium">
          Notes
          <textarea
            className="input mt-1"
            rows={2}
            value={draft.description}
            onChange={(e) => history.change({ ...draft, description: e.target.value })}
          />
        </label>
      )}
      {message && (
        <p role="status" className="rounded bg-slate-100 p-2 text-sm dark:bg-slate-800">
          {message}
        </p>
      )}
      {!formationOnly && (
        <DrawingToolbar
          tool={tool}
          onTool={(t) => {
            setTool(t);
            setEditPath(undefined);
            setTargetActionId(undefined);
          }}
          color={ink}
          onColor={setInk}
          {...history}
          clear={() => history.change({ ...draft, drawings: [] })}
        />
      )}
      {formationOnly && (
        <div className="flex gap-2">
          <Button size="sm" disabled={!history.canUndo} onClick={history.undo}>
            Undo
          </Button>
          <Button size="sm" disabled={!history.canRedo} onClick={history.redo}>
            Redo
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={fillCount === 0}
          onClick={() => {
            history.change(autofilled);
            const remaining = draft.players.length - assignedCount - fillCount;
            setMessage(
              `Assigned ${fillCount} available roster player${fillCount === 1 ? '' : 's'}.${remaining ? ` ${remaining} slot${remaining === 1 ? '' : 's'} still unassigned; add more available players to your roster.` : ' All seven slots are assigned.'}`,
            );
          }}
        >
          Autofill from roster
        </Button>
        <span className="text-sm text-slate-500">{assignedCount} / 7 assigned</span>
        <p className="w-full text-xs text-slate-500">
          Fills empty slots with available players by jersey number. Keeps your existing
          assignments.
          {fillCount === 0 && assignedCount < 7
            ? ' No additional available players on this roster.'
            : ''}
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <FootballField
            roster={roster}
            players={draft.players}
            quarterbackId={draft.quarterbackId}
            snapperId={draft.snapperId}
            ballActions={formationOnly ? [] : draft.ballActions}
            drawings={draft.drawings}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setEditPath(undefined);
            }}
            onPlayers={(players) => history.change({ ...draft, players }, false)}
            onDrawings={(drawings) => history.change({ ...draft, drawings }, false)}
            onGestureStart={history.checkpoint}
            tool={tool}
            ink={ink}
            editPath={editPath}
            onTarget={
              targetActionId
                ? (target) => {
                    editAction(targetActionId, { target });
                    setTargetActionId(undefined);
                  }
                : undefined
            }
          />
          <p className="mt-2 text-xs text-slate-500">
            Drag players or select a token and use arrow keys. Gold = QB; blue = snapper. Drag gold
            route points to reshape a path. Purple = pre-snap motion. Yard marks are tactical
            references.
          </p>
          {editPath && (
            <p role="status" className="mt-2 text-sm">
              Click the field to add {editPath} points; drag handles to adjust them.
            </p>
          )}
          {targetActionId && (
            <p role="status" className="mt-2 text-sm">
              Click the field to place the exchange or throw target.
            </p>
          )}
        </div>
        <aside className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <h2 className="font-bold">Player assignments</h2>
          <label className="block text-sm">
            Selected player
            <select
              className="input mt-1"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setEditPath(undefined);
              }}
            >
              {slotOptions}
            </select>
          </label>
          <label className="block text-sm">
            Slot label
            <input
              className="input mt-1"
              maxLength={5}
              value={selected.label}
              onChange={(e) => updatePlayer({ label: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Roster player
            <select
              className="input mt-1"
              value={selected.rosterPlayerId ?? ''}
              onChange={(e) =>
                history.change({
                  ...draft,
                  players: draft.players.map((p) =>
                    p.id === selectedId
                      ? { ...p, rosterPlayerId: e.target.value || undefined }
                      : p.rosterPlayerId === e.target.value && e.target.value
                        ? { ...p, rosterPlayerId: undefined }
                        : p,
                  ),
                })
              }
            >
              <option value="">Unassigned</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.availability === 'unavailable' ? ' (unavailable)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Quarterback
            <select
              className="input mt-1"
              value={draft.quarterbackId}
              onChange={(e) => designate('quarterbackId', e.target.value)}
            >
              {slotOptions}
            </select>
          </label>
          <label className="block text-sm">
            Snapper
            <select
              className="input mt-1"
              value={draft.snapperId}
              onChange={(e) => designate('snapperId', e.target.value)}
            >
              {slotOptions}
            </select>
          </label>
          {!formationOnly && (
            <>
              <label className="block text-sm">
                Route / assignment
                <select
                  className="input mt-1"
                  value={selected.route.type}
                  onChange={(e) => {
                    updatePlayer({
                      route: makeRoute(
                        e.target.value as RouteType,
                        selected.route.depth,
                        selected.position.x > 50 ? -1 : 1,
                      ),
                    });
                    setEditPath(e.target.value === 'custom' ? 'route' : undefined);
                    setTool('select');
                  }}
                >
                  {Object.entries(ROUTE_LABELS).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Route depth
                <input
                  aria-label="Route depth"
                  type="range"
                  min={3}
                  max={55}
                  value={selected.route.depth}
                  className="mt-1 w-full"
                  onChange={(e) =>
                    updatePlayer({ route: resizeRoute(selected.route, Number(e.target.value)) })
                  }
                />
              </label>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => updatePlayer({ route: flipRoute(selected.route) })}
                >
                  Flip left/right
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => updatePlayer({ route: rotateRoute(selected.route, -15) })}
                >
                  Rotate ↶
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => updatePlayer({ route: rotateRoute(selected.route, 15) })}
                >
                  Rotate ↷
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={editPath === 'route' ? 'primary' : 'secondary'}
                  onClick={() => {
                    setEditPath(editPath === 'route' ? undefined : 'route');
                    setTool('select');
                  }}
                >
                  Draw route points
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    updatePlayer({
                      route: { ...selected.route, points: selected.route.points.slice(0, -1) },
                    })
                  }
                >
                  Remove last point
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={editPath === 'motion' ? 'primary' : 'secondary'}
                  onClick={() => {
                    setEditPath(editPath === 'motion' ? undefined : 'motion');
                    setTool('select');
                  }}
                >
                  Add / edit motion
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => updatePlayer({ motion: undefined })}
                >
                  Clear motion
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>
      {!formationOnly && (
        <section className="space-y-3 rounded-xl border p-3 dark:border-slate-700">
          <h2 className="font-bold">Ball sequence</h2>
          <p className="text-sm text-slate-500">
            Actions run in order. Fake exchanges keep possession with the sender. Place a target for
            a handoff, pitch, or throw away from a route endpoint.
          </p>
          {[...draft.ballActions]
            .sort((a, b) => a.order - b.order)
            .map((a, index) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded bg-slate-100 p-2 dark:bg-slate-800"
              >
                <span className="text-sm">{index + 1}.</span>
                <select
                  aria-label={`Action ${index + 1} type`}
                  className="input w-auto"
                  value={a.type}
                  disabled={a.type === 'snap'}
                  onChange={(e) => editAction(a.id, { type: e.target.value as BallActionType })}
                >
                  {a.type === 'snap' ? (
                    <option value="snap">Snap</option>
                  ) : (
                    (['pass', 'handoff', 'pitch'] as const).map((t) => <option key={t}>{t}</option>)
                  )}
                </select>
                <select
                  aria-label={`Action ${index + 1} from`}
                  className="input w-auto"
                  value={a.fromPlayerId}
                  disabled={a.type === 'snap'}
                  onChange={(e) => editAction(a.id, { fromPlayerId: e.target.value })}
                >
                  {slotOptions}
                </select>
                <span>→</span>
                <select
                  aria-label={`Action ${index + 1} to`}
                  className="input w-auto"
                  value={a.toPlayerId}
                  disabled={a.type === 'snap'}
                  onChange={(e) => editAction(a.id, { toPlayerId: e.target.value })}
                >
                  {slotOptions}
                </select>
                {a.type !== 'snap' && (
                  <>
                    <label className="flex gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={a.fake}
                        onChange={(e) => editAction(a.id, { fake: e.target.checked })}
                      />
                      Fake
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setTargetActionId(a.id);
                        setTool('select');
                        setEditPath(undefined);
                      }}
                    >
                      Place target
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => editAction(a.id, { target: undefined })}
                    >
                      Use route end
                    </Button>
                    <Button
                      aria-label={`Move action ${index + 1} up`}
                      size="sm"
                      disabled={index <= 1}
                      onClick={() => reorderAction(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      aria-label={`Move action ${index + 1} down`}
                      size="sm"
                      disabled={index === draft.ballActions.length - 1}
                      onClick={() => reorderAction(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        history.change({
                          ...draft,
                          ballActions: draft.ballActions
                            .filter((action) => action.id !== a.id)
                            .map((action, order) => ({ ...action, order })),
                        })
                      }
                    >
                      Remove action
                    </Button>
                  </>
                )}
              </div>
            ))}
          <div className="flex flex-wrap gap-2">
            {(['pass', 'handoff', 'pitch'] as const).map((type) => (
              <Button
                key={type}
                size="sm"
                variant="secondary"
                onClick={() =>
                  history.change({
                    ...draft,
                    ballActions: [
                      ...draft.ballActions,
                      {
                        id: createId(),
                        type,
                        fromPlayerId: draft.quarterbackId,
                        toPlayerId:
                          selectedId !== draft.quarterbackId ? selectedId : draft.snapperId,
                        order: draft.ballActions.length,
                        fake: false,
                      },
                    ],
                  })
                }
              >
                Add {type === 'pitch' ? 'pitch / lateral' : type}
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
