import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { Button } from '../components/common/Button';
import { Dialog } from '../components/common/Dialog';
import { FootballEditor } from './FootballEditor';
import { FootballField } from './FootballField';
import { newFormation, playFromFormation } from './domain';
import { savePlay } from './repository';
import { useFootballData } from './useFootballData';
import type { FootballFormation } from './types';

export function FormationsPage() {
  const { team, formations = [], players = [], loaded } = useFootballData();
  const [editing, setEditing] = useState<FootballFormation>();
  const [remove, setRemove] = useState<FootballFormation>();
  const [error, setError] = useState('');
  const navigate = useNavigate();
  if (!team || !loaded) return <p className="p-4">Loading formations…</p>;
  if (editing)
    return (
      <FootballEditor
        key={editing.id}
        initial={{ ...playFromFormation(editing), id: editing.id, name: editing.name }}
        roster={players}
        formationOnly
        onClose={() => setEditing(undefined)}
      />
    );
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex justify-between gap-3">
        <h1 className="text-2xl font-bold">Football formations</h1>
        <Button variant="primary" onClick={() => setEditing(newFormation(team.id))}>
          New formation
        </Button>
      </div>
      <p className="text-sm text-slate-500">
        Seven offensive slots with one QB and one snapper. Any other slot can receive, run, or
        block. Assign your roster, then build plays from a saved formation.
      </p>
      {error && <p role="alert">{error}</p>}
      {!formations.length && <p>No saved formations yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {formations.map((f) => (
          <article key={f.id} className="space-y-2 rounded-xl border p-3 dark:border-slate-700">
            <FootballField
              roster={players}
              {...f}
              players={f.players.map((p) => ({
                ...p,
                route: { ...p.route, points: [] },
                motion: undefined,
              }))}
              preview
            />
            <h2 className="font-bold">{f.name}</h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(f)}>
                Edit formation
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  try {
                    const play = playFromFormation(f);
                    await savePlay(play);
                    navigate(`/football/plays/${play.id}`);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Could not create play.');
                  }
                }}
              >
                Create play
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemove(f)}>
                Delete
              </Button>
            </div>
          </article>
        ))}
      </div>
      <Dialog
        open={!!remove}
        title="Delete formation?"
        description="Saved plays keep their own positions and assignments."
        onClose={() => setRemove(undefined)}
        footer={
          <>
            <Button onClick={() => setRemove(undefined)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (remove) {
                  try {
                    await db.footballFormations.delete(remove.id);
                    setRemove(undefined);
                  } catch {
                    setError('Could not delete formation.');
                  }
                }
              }}
            >
              Delete formation
            </Button>
          </>
        }
      >
        <p>{remove?.name}</p>
      </Dialog>
    </div>
  );
}
