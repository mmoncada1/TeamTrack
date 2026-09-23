import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { MatchFormat } from '../types';
import { MATCH_FORMAT_PLAYER_COUNT, DEFAULT_THRESHOLDS } from '../types';
import { useRosterStore } from '../state/rosterStore';
import { useTeamStore } from '../state/teamStore';
import { useMatchStore } from '../state/matchStore';
import { getDefaultFormationForFormat, getFormationsForFormat } from '../formations/definitions';
import { validateMatchSetup } from '../lib/validation';
import { Button } from '../components/common/Button';
import { ThresholdSliders } from '../components/setup/ThresholdSliders';
import { FieldWorkspace } from '../components/match/FieldWorkspace';
import { deriveMatchState } from '../lib/matchEngine';
import { jerseyLabel } from '../lib/playerSort';
import { MatchActionError } from '../lib/matchActions';
import { clampMinGirls, TOO_MANY_GUYS_MESSAGE } from '../lib/coed';
import { TooManyGuysDialog } from '../components/match/TooManyGuysDialog';

const FORMATS: MatchFormat[] = ['7v7', '9v9', '11v11'];

export function MatchSetupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const roster = useRosterStore();
  const activeTeam = useTeamStore((s) => s.teams.find((team) => team.id === s.activeTeamId) ?? null);
  const teams = useTeamStore((s) => s.teams);
  const store = useMatchStore();
  const [initializing, setInitializing] = useState(true);
  const [moveSummary, setMoveSummary] = useState<string | null>(null);
  const [coedBlocked, setCoedBlocked] = useState(false);

  useEffect(() => {
    if (!roster.loaded) roster.load();
  }, [roster.loaded, roster.load]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (id) {
        await store.loadMatch(id);
        if (!cancelled) setInitializing(false);
        return;
      }
      if (!roster.loaded || !activeTeam) return;
      const defaultFormation = getDefaultFormationForFormat('7v7');
      const teamPlayers = roster.players.filter((p) => p.teamId === activeTeam.id);
      const activePlayerIds = teamPlayers.filter((p) => p.availability === 'active').map((p) => p.id);
      const newId = await store.createDraft({
        teamId: activeTeam.id,
        teamName: activeTeam.name,
        opponentName: '',
        date: new Date().toISOString().slice(0, 10),
        format: '7v7',
        formationId: defaultFormation.id,
        halfLengthMinutes: 25,
        numberOfHalves: 2,
        thresholds: DEFAULT_THRESHOLDS,
        goalkeeperRotationEnabled: false,
        alertSoundEnabled: false,
        rosterPlayerIds: activePlayerIds,
        unavailablePlayerIds: [],
      }, teamPlayers);
      if (!cancelled) navigate(`/match/${newId}/setup`, { replace: true });
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, roster.loaded, activeTeam]);

  const match = store.match;
  const derived = useMemo(() => (match ? deriveMatchState(match) : null), [match]);

  if (initializing || !match || !derived) {
    return <div className="p-8 text-center text-slate-500">Loading match setup…</div>;
  }

  const formationsForFormat = getFormationsForFormat(match.settings.format);
  const activeFormation = formationsForFormat.find((f) => f.id === match.pendingFormationId) ?? formationsForFormat[0];

  const validation = validateMatchSetup({
    teamName: match.teamName,
    opponentName: match.opponentName,
    date: match.date,
    title: match.title,
    format: match.settings.format,
    formationId: match.pendingFormationId,
    halfLengthMinutes: match.settings.halfLengthMinutes,
    numberOfHalves: match.settings.numberOfHalves,
    rosterPlayerIds: match.rosterPlayerIds,
    assignments: match.pendingAssignments,
  });

  function handleFormatChange(format: MatchFormat) {
    const formation = getDefaultFormationForFormat(format);
    store.updateDraftMeta({ settings: { format } });
    const summary = store.setPendingFormation(formation.id, roster.players);
    setMoveSummary(summary);
  }

  function toggleRosterPlayer(playerId: string, checked: boolean) {
    const current = match as NonNullable<typeof match>;
    const next = checked
      ? [...current.rosterPlayerIds, playerId]
      : current.rosterPlayerIds.filter((id2) => id2 !== playerId);
    store.updateDraftMeta({ rosterPlayerIds: next, unavailablePlayerIds: current.unavailablePlayerIds.filter((id2) => next.includes(id2)) });
  }

  function toggleUnavailable(playerId: string, unavailable: boolean) {
    const current = match as NonNullable<typeof match>;
    const next = unavailable
      ? [...current.unavailablePlayerIds, playerId]
      : current.unavailablePlayerIds.filter((id2) => id2 !== playerId);
    store.updateDraftMeta({ unavailablePlayerIds: next });
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold">New match setup</h1>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Team name" htmlFor="teamName" required>
          <input
            id="teamName"
            className="input"
            value={match.teamName}
            onChange={(e) => store.updateDraftMeta({ teamName: e.target.value })}
          />
        </Field>
        <Field label="Opponent name" htmlFor="opponentName" required>
          <input
            id="opponentName"
            className="input"
            value={match.opponentName}
            onChange={(e) => store.updateDraftMeta({ opponentName: e.target.value })}
          />
        </Field>
        <Field label="Match date" htmlFor="date" required>
          <input
            id="date"
            type="date"
            className="input"
            value={match.date}
            onChange={(e) => store.updateDraftMeta({ date: e.target.value })}
          />
        </Field>
        <Field label="Match title (optional)" htmlFor="title">
          <input
            id="title"
            className="input"
            value={match.title ?? ''}
            onChange={(e) => store.updateDraftMeta({ title: e.target.value })}
          />
        </Field>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Format &amp; formation</h2>
        <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Match format">
          {FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              role="radio"
              aria-checked={match.settings.format === format}
              onClick={() => handleFormatChange(format)}
              className={`min-h-[44px] rounded-lg border px-4 py-2 font-medium ${
                match.settings.format === format
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
              }`}
            >
              {format}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <label htmlFor="formation" className="block text-sm font-medium">
            Formation
          </label>
          <select
            id="formation"
            className="input mt-1 max-w-xs"
            value={match.pendingFormationId}
            onChange={(e) => setMoveSummary(store.setPendingFormation(e.target.value, roster.players))}
          >
            {formationsForFormat.map((f) => (
              <option key={f.id} value={f.id}>
                {f.shape}
              </option>
            ))}
          </select>
        </div>
        {moveSummary && (
          <p role="status" className="mt-2 text-sm text-blue-700 dark:text-blue-300">
            {moveSummary}
          </p>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Half length (minutes)" htmlFor="halfLength" required>
          <input
            id="halfLength"
            type="number"
            min={1}
            className="input"
            value={match.settings.halfLengthMinutes}
            onChange={(e) => store.updateDraftMeta({ settings: { halfLengthMinutes: Number(e.target.value) } })}
          />
        </Field>
        <Field label="Number of halves" htmlFor="halves" required>
          <select
            id="halves"
            className="input"
            value={match.settings.numberOfHalves}
            onChange={(e) => store.updateDraftMeta({ settings: { numberOfHalves: Number(e.target.value) as 1 | 2 } })}
          >
            <option value={2}>2 halves</option>
            <option value={1}>1 running clock</option>
          </select>
        </Field>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Substitution thresholds</h2>
        <div className="mt-2">
          <ThresholdSliders
            thresholds={match.settings.thresholds}
            onChange={(group, next) =>
              store.updateDraftMeta({ settings: { thresholds: { ...match.settings.thresholds, [group]: next } } })
            }
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={match.settings.goalkeeperRotationEnabled}
            onChange={(e) => store.updateDraftMeta({ settings: { goalkeeperRotationEnabled: e.target.checked } })}
          />
          Enable goalkeeper rotation alerts
        </label>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Roster for this match</h2>
        <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {roster.players.filter((player) => player.teamId === match.teamId).map((p) => {
            const included = match.rosterPlayerIds.includes(p.id);
            const unavailable = match.unavailablePlayerIds.includes(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between gap-1 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={included} onChange={(e) => toggleRosterPlayer(p.id, e.target.checked)} />
                  {jerseyLabel(p.jerseyNumber)} {p.name}
                </label>
                {included && (
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input type="checkbox" checked={unavailable} onChange={(e) => toggleUnavailable(p.id, e.target.checked)} />
                    Unavailable
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Assign players</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Drag players onto the field, or use the "Move…" button for keyboard/non-drag assignment.
        </p>
        <div className="mt-3">
          <FieldWorkspace
            positions={activeFormation.positions}
            assignments={match.pendingAssignments}
            players={roster.players.filter((p) => match.rosterPlayerIds.includes(p.id))}
            rosterPlayerIds={match.rosterPlayerIds}
            unavailablePlayerIds={match.unavailablePlayerIds}
            onRequestMove={(playerId, toSlot) => {
              try {
                store.movePendingPlayer(playerId, toSlot);
              } catch (err) {
                if (err instanceof MatchActionError && err.message === TOO_MANY_GUYS_MESSAGE) setCoedBlocked(true);
              }
            }}
          />
        </div>
      </section>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <section className="mt-6 space-y-2">
          {validation.errors.map((e, i) => (
            <p key={i} role="alert" className="rounded bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              {e.message}
            </p>
          ))}
          {validation.warnings.map((w, i) => (
            <p key={i} className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {w.message}
            </p>
          ))}
        </section>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate('/')}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={validation.isBlocking}
          onClick={() => {
            try {
              store.start();
            } catch (err) {
              if (err instanceof MatchActionError && err.message === TOO_MANY_GUYS_MESSAGE) {
                setCoedBlocked(true);
                return;
              }
              throw err;
            }
            navigate(`/match/${match.id}/live`);
          }}
        >
          Start match ({Object.keys(match.pendingAssignments).length}/{MATCH_FORMAT_PLAYER_COUNT[match.settings.format]} on field)
        </Button>
      </div>

      <TooManyGuysDialog
        open={coedBlocked}
        minGirls={(() => {
          const matchTeam = teams.find((entry) => entry.id === match.teamId);
          return matchTeam?.coed ? clampMinGirls(matchTeam.minGirlsOnField) : 0;
        })()}
        onDismiss={() => setCoedBlocked(false)}
      />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
