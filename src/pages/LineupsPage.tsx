import { useEffect, useMemo, useState } from 'react';
import type { MatchFormat, SavedLineup, SlotId } from '../types';
import { MATCH_FORMAT_PLAYER_COUNT } from '../types';
import { useRosterStore } from '../state/rosterStore';
import { useTeamStore } from '../state/teamStore';
import { useLineupStore, type LineupDraft } from '../state/lineupStore';
import { getDefaultFormationForFormat, getFormationById, getFormationsForFormat } from '../formations/definitions';
import { fillFormationByPreference } from '../formations/fill';
import { moveAssignment } from '../lib/lineupAssignments';
import { clampMinGirls, moveLeavesTooManyGuys } from '../lib/coed';
import { FieldWorkspace } from '../components/match/FieldWorkspace';
import { TooManyGuysDialog } from '../components/match/TooManyGuysDialog';
import { Button } from '../components/common/Button';
import { Dialog } from '../components/common/Dialog';

const FORMATS: MatchFormat[] = ['7v7', '9v9', '11v11'];

export function LineupsPage() {
  const roster = useRosterStore();
  const activeTeam = useTeamStore((s) => s.teams.find((team) => team.id === s.activeTeamId) ?? null);
  const { lineups, loaded, load, createLineup, updateLineup, deleteLineup } = useLineupStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LineupDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [coedBlocked, setCoedBlocked] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedLineup | null>(null);

  useEffect(() => {
    if (!roster.loaded) roster.load();
  }, [roster.loaded, roster.load]);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const teamPlayers = useMemo(
    () => roster.players.filter((player) => !activeTeam || player.teamId === activeTeam.id),
    [roster.players, activeTeam],
  );
  const teamLineups = lineups.filter((lineup) => !activeTeam || lineup.teamId === activeTeam.id);
  const playersById = useMemo(() => new Map(teamPlayers.map((p) => [p.id, p])), [teamPlayers]);
  const coedRule = activeTeam?.coed ? { minGirlsOnField: clampMinGirls(activeTeam.minGirlsOnField) } : undefined;

  const formation = draft ? getFormationById(draft.formationId) : undefined;

  function startNewLineup() {
    const format: MatchFormat = '7v7';
    const defaultFormation = getDefaultFormationForFormat(format);
    setEditingId(null);
    setError(null);
    setNotice(null);
    setDraft({ name: '', format, formationId: defaultFormation.id, assignments: {} });
  }

  function startEditing(lineup: SavedLineup) {
    setEditingId(lineup.id);
    setError(null);
    setNotice(null);
    setDraft({
      name: lineup.name,
      format: lineup.format,
      formationId: lineup.formationId,
      assignments: { ...lineup.assignments },
    });
  }

  function closeEditor() {
    setDraft(null);
    setEditingId(null);
    setError(null);
    setNotice(null);
  }

  function changeFormat(format: MatchFormat) {
    if (!draft) return;
    const next = getDefaultFormationForFormat(format);
    setDraft({ ...draft, format, formationId: next.id, assignments: {} });
    setNotice('Formation reset for the new format.');
  }

  function changeFormation(formationId: string) {
    if (!draft) return;
    setDraft({ ...draft, formationId, assignments: {} });
    setNotice('Positions cleared for the new formation.');
  }

  function autoFill() {
    if (!draft || !formation) return;
    const eligible = teamPlayers.filter((player) => player.availability === 'active');
    const { assignments, summary } = fillFormationByPreference(
      formation,
      eligible,
      eligible.map((player) => player.id),
      [],
      coedRule,
    );
    setDraft({ ...draft, assignments });
    setNotice(summary);
  }

  function handleMove(playerId: string, toSlot: SlotId) {
    if (!draft) return;
    const next = moveAssignment(draft.assignments, playerId, toSlot);
    if (next === draft.assignments) return;
    if (
      coedRule &&
      moveLeavesTooManyGuys(coedRule, teamPlayers, Object.values(draft.assignments), Object.values(next))
    ) {
      setCoedBlocked(true);
      return;
    }
    setNotice(null);
    setDraft({ ...draft, assignments: next });
  }

  async function save() {
    if (!draft || !activeTeam) return;
    const result = editingId
      ? await updateLineup(editingId, draft)
      : await createLineup(activeTeam.id, draft);
    if (result.error) {
      setError(result.error);
      return;
    }
    closeEditor();
  }

  if (draft && formation) {
    const placed = Object.keys(draft.assignments).length;
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{editingId ? 'Edit lineup' : 'New lineup'}</h1>
          <Button variant="ghost" onClick={closeEditor}>
            Back to lineups
          </Button>
        </div>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lineup-name" className="block text-sm font-medium">
              Lineup name
            </label>
            <input
              id="lineup-name"
              className="input mt-1"
              placeholder="e.g. Strong start"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="lineup-formation" className="block text-sm font-medium">
              Formation
            </label>
            <select
              id="lineup-formation"
              className="input mt-1"
              value={draft.formationId}
              onChange={(e) => changeFormation(e.target.value)}
            >
              {getFormationsForFormat(draft.format).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.shape}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Match format">
          {FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              role="radio"
              aria-checked={draft.format === format}
              onClick={() => changeFormat(format)}
              className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-sm font-medium ${
                draft.format === format
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
              }`}
            >
              {format}
            </button>
          ))}
          <Button variant="secondary" size="sm" onClick={autoFill}>
            Auto-fill by position
          </Button>
          <span className="text-sm text-slate-500">
            {placed}/{MATCH_FORMAT_PLAYER_COUNT[draft.format]} placed
          </span>
        </div>

        {notice && (
          <p role="status" className="mt-2 text-sm text-blue-700 dark:text-blue-300">
            {notice}
          </p>
        )}

        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Drag players onto the field, or use the "Move…" button. Nothing here affects a match until you pick this
          lineup for one.
        </p>
        <div className="mt-3">
          <FieldWorkspace
            positions={formation.positions}
            assignments={draft.assignments}
            players={teamPlayers}
            rosterPlayerIds={teamPlayers.map((player) => player.id)}
            unavailablePlayerIds={[]}
            onRequestMove={handleMove}
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={closeEditor}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {editingId ? 'Save changes' : 'Save lineup'}
          </Button>
        </div>

        <TooManyGuysDialog
          open={coedBlocked}
          minGirls={coedRule?.minGirlsOnField ?? 0}
          onDismiss={() => setCoedBlocked(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lineups</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Build and test starting lineups ahead of time, then pick one when you create a match.
          </p>
        </div>
        <Button variant="primary" onClick={startNewLineup} disabled={!activeTeam}>
          + New lineup
        </Button>
      </div>

      {teamLineups.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600">
          No saved lineups yet. Create one and it will be available when you set up a match.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {teamLineups.map((lineup) => {
            const shape = getFormationById(lineup.formationId)?.shape ?? lineup.formationId;
            const names = Object.values(lineup.assignments)
              .map((playerId) => playersById.get(playerId)?.name)
              .filter((name): name is string => !!name);
            return (
              <li
                key={lineup.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{lineup.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {lineup.format} · {shape} · {names.length} player{names.length === 1 ? '' : 's'}
                  </p>
                  {names.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{names.join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEditing(lineup)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(lineup)}>
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name ?? 'this lineup'}?`}
        description="Matches that already used this lineup keep their own lineup."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleteTarget) await deleteLineup(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete lineup
            </Button>
          </>
        }
      >
        <p className="text-sm">This only removes the saved lineup.</p>
      </Dialog>
    </div>
  );
}
