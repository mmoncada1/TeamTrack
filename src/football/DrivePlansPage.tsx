import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { Button } from '../components/common/Button';
import { createId } from '../lib/id';
import { moveDriveEntry } from './domain';
import { useFootballData } from './useFootballData';
import { FootballField } from './FootballField';
import { saveDrive } from './repository';
import type { DrivePlan } from './types';
import { useHistory } from '../drawing/useHistory';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

export function DrivePlansPage() {
  const { team, drives = [], plays = [], loaded } = useFootballData();
  const [editing, setEditing] = useState<DrivePlan>();
  const [error, setError] = useState('');
  if (!team || !loaded) return <p className="p-4">Loading drive plans…</p>;
  if (editing)
    return <DriveEditor key={editing.id} initial={editing} onClose={() => setEditing(undefined)} />;
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="text-2xl font-bold">Drive plans</h1>
        <Button
          variant="primary"
          onClick={() =>
            setEditing({
              id: createId(),
              teamId: team.id,
              name: 'Drive 1',
              entries: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
          }
        >
          New drive plan
        </Button>
      </div>
      <p className="text-sm text-slate-500">
        Build an ordered call sheet. Repeat a play as often as needed. Drive plans are separate from
        match tracking.
      </p>
      {error && <p role="alert">{error}</p>}
      {!drives.length && <p>No drive plans yet.</p>}
      {drives.map((d) => (
        <article
          key={d.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 dark:border-slate-700"
        >
          <div>
            <h2 className="font-bold">{d.name}</h2>
            <p className="text-sm text-slate-500">
              {d.entries
                .map((e) => plays.find((p) => p.id === e.playId)?.name ?? 'Missing play')
                .join(' → ') || 'Empty drive'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(d)}>
              Open drive
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (window.confirm(`Delete ${d.name}?`)) {
                  try {
                    await db.drivePlans.delete(d.id);
                  } catch {
                    setError('Could not delete drive.');
                  }
                }
              }}
            >
              Delete
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
function DriveEditor({ initial, onClose }: { initial: DrivePlan; onClose: () => void }) {
  const { plays = [] } = useFootballData();
  const history = useHistory(initial);
  const draft = history.value;
  const [playId, setPlayId] = useState('');
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(JSON.stringify(initial));
  useUnsavedChanges(JSON.stringify(draft) !== saved);
  const currentIndex = Math.min(index, Math.max(0, draft.entries.length - 1));
  const entry = draft.entries[currentIndex];
  const current = plays.find((p) => p.id === entry?.playId);
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Drive planner</h1>
        <Button
          variant="secondary"
          onClick={() => {
            if (JSON.stringify(draft) === saved || window.confirm('Discard unsaved drive edits?'))
              onClose();
          }}
        >
          Back
        </Button>
        <Button
          variant="primary"
          onClick={async () => {
            try {
              await saveDrive(draft);
              setSaved(JSON.stringify(draft));
              setMessage('Drive saved.');
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Could not save drive.');
            }
          }}
        >
          Save drive
        </Button>
      </div>
      <label className="block text-sm">
        Drive name
        <input
          className="input mt-1"
          value={draft.name}
          onChange={(e) => history.change({ ...draft, name: e.target.value })}
        />
      </label>
      {message && <p role="status">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Play to add"
          className="input w-auto"
          value={playId}
          onChange={(e) => setPlayId(e.target.value)}
        >
          <option value="">Choose play</option>
          {plays.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          disabled={!plays.some((p) => p.id === playId)}
          variant="secondary"
          onClick={() =>
            history.change({ ...draft, entries: [...draft.entries, { id: createId(), playId }] })
          }
        >
          Add play
        </Button>
        <Button disabled={!history.canUndo} onClick={history.undo}>
          Undo
        </Button>
        <Button disabled={!history.canRedo} onClick={history.redo}>
          Redo
        </Button>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ol className="space-y-2">
          {draft.entries.map((e, i) => (
            <li
              key={e.id}
              className={`flex flex-wrap items-center gap-2 rounded border p-2 ${e.id === entry?.id ? 'border-emerald-500' : 'dark:border-slate-700'}`}
            >
              <Button size="sm" variant="ghost" onClick={() => setIndex(i)}>
                {i + 1}. {plays.find((p) => p.id === e.playId)?.name ?? 'Missing play'}
              </Button>
              <Button
                aria-label={`Move play ${i + 1} up`}
                size="sm"
                disabled={i === 0}
                onClick={() => {
                  history.change({ ...draft, entries: moveDriveEntry(draft.entries, i, i - 1) });
                  setIndex(i - 1);
                }}
              >
                ↑
              </Button>
              <Button
                aria-label={`Move play ${i + 1} down`}
                size="sm"
                disabled={i === draft.entries.length - 1}
                onClick={() => {
                  history.change({ ...draft, entries: moveDriveEntry(draft.entries, i, i + 1) });
                  setIndex(i + 1);
                }}
              >
                ↓
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  history.change({
                    ...draft,
                    entries: [
                      ...draft.entries.slice(0, i + 1),
                      { id: createId(), playId: e.playId },
                      ...draft.entries.slice(i + 1),
                    ],
                  })
                }
              >
                Repeat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  history.change({
                    ...draft,
                    entries: draft.entries.filter((item) => item.id !== e.id),
                  })
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ol>
        {current && (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Button disabled={currentIndex <= 0} onClick={() => setIndex(Math.max(0, currentIndex - 1))}>
                Previous
              </Button>
              <span className="text-sm">
                {currentIndex + 1} / {draft.entries.length}
              </span>
              <Button
                disabled={currentIndex >= draft.entries.length - 1}
                onClick={() => setIndex(Math.min(draft.entries.length - 1, currentIndex + 1))}
              >
                Next
              </Button>
            </div>
            <h2 className="font-bold">{current.name}</h2>
            <FootballField {...current} preview />
            <p className="text-sm">{current.description}</p>
            <Link
              className="text-emerald-700 underline dark:text-emerald-300"
              to={`/football/plays/${current.id}`}
            >
              Open play editor
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
