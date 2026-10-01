import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Dialog } from '../components/common/Dialog';
import { FootballField } from './FootballField';
import { useFootballData } from './useFootballData';
import { duplicatePlay, instantiateTemplate, newFormation, playFromFormation } from './domain';
import { PLAY_TEMPLATES } from './templates';
import { deletePlay, savePlay } from './repository';
import type { FootballPlay } from './types';

export function PlaybookPage() {
  const { team, plays = [], formations = [], loaded } = useFootballData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [formationId, setFormationId] = useState('');
  const [remove, setRemove] = useState<FootballPlay>();
  const [error, setError] = useState('');
  async function create(play: FootballPlay) {
    try {
      await savePlay(play);
      navigate(`/football/plays/${play.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create play.');
    }
  }
  if (!team || !loaded) return <p className="p-4">Loading playbook…</p>;
  const tags = [...new Set(plays.flatMap((p) => p.tags).filter(Boolean))].sort();
  const visible = plays.filter(
    (p) =>
      (!tag || p.tags.includes(tag)) &&
      `${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">{team.name} playbook</h1>
        <p className="mt-1 text-sm text-slate-500">
          Editable 7v7 flag plays. Start with a formation or a common concept, then make it yours.
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => create(playFromFormation(newFormation(team.id)))}>
          New play
        </Button>
        <select
          aria-label="Starting formation"
          className="input w-auto"
          value={formationId}
          onChange={(e) => setFormationId(e.target.value)}
        >
          <option value="">Choose saved formation</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          disabled={!formations.some((f) => f.id === formationId)}
          onClick={() => {
            const f = formations.find((f) => f.id === formationId);
            if (f) create(playFromFormation(f));
          }}
        >
          Create from formation
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Search plays"
          className="input flex-1"
          type="search"
          placeholder="Search plays, notes, tags"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter plays by tag"
          className="input w-auto"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      {visible.length === 0 && (
        <p className="text-slate-500">
          {plays.length
            ? 'No matching plays.'
            : 'Your playbook is empty. Create a play or choose a starter below.'}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((play) => (
          <article key={play.id} className="space-y-2 rounded-xl border p-3 dark:border-slate-700">
            <Link to={`/football/plays/${play.id}`} aria-label={`Edit ${play.name}`}>
              <FootballField {...play} preview />
              <h2 className="mt-2 font-bold">{play.name}</h2>
            </Link>
            <p className="text-xs text-slate-500">{play.tags.filter(Boolean).join(' · ')}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => create(duplicatePlay(play))}>
                Duplicate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemove(play)}>
                Delete
              </Button>
            </div>
          </article>
        ))}
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Starter concepts</h2>
        <p className="text-sm text-slate-500">
          Original 7v7 adaptations. Loading a starter creates your own editable copy. Adjust
          blocking and ball exchanges for your league.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLAY_TEMPLATES.map((template) => (
            <article key={template.id} className="rounded-xl border p-3 dark:border-slate-700">
              <details>
                <summary className="cursor-pointer font-semibold">{template.name}</summary>
                <div className="mt-2">
                  <FootballField {...template} preview />
                  <p className="mt-2 text-sm text-slate-500">{template.description}</p>
                </div>
              </details>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => create(instantiateTemplate(template, team.id))}
              >
                Use {template.name}
              </Button>
            </article>
          ))}
        </div>
      </section>
      <Dialog
        open={!!remove}
        title="Delete play?"
        description="This also removes its entries from saved drive plans."
        onClose={() => setRemove(undefined)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemove(undefined)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (remove) {
                  try {
                    await deletePlay(remove.id);
                    setRemove(undefined);
                  } catch {
                    setError('Could not delete play.');
                  }
                }
              }}
            >
              Delete play
            </Button>
          </>
        }
      >
        <p>{remove?.name}</p>
      </Dialog>
    </div>
  );
}
