import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatchStore } from '../state/matchStore';
import { useRosterStore } from '../state/rosterStore';
import { buildMatchSummary } from '../lib/stats';
import { formatClock } from '../lib/timer';
import { describeEvent, eventDisplayMs } from '../lib/eventDescriptions';
import { exportPlayerSummaryAsCsv } from '../lib/exportImport';
import { Button } from '../components/common/Button';
import { PlayerAvatar } from '../components/common/PlayerAvatar';
import { jerseyLabel } from '../lib/playerSort';

export function MatchSummaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useMatchStore();
  const roster = useRosterStore();

  useEffect(() => {
    if (!roster.loaded) roster.load();
  }, [roster.loaded, roster.load]);

  useEffect(() => {
    if (id) store.loadMatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const match = store.match?.id === id ? store.match : null;
  const summary = useMemo(() => (match ? buildMatchSummary(match, roster.players) : null), [match, roster.players]);
  const playersById = useMemo(() => new Map(roster.players.map((p) => [p.id, p])), [roster.players]);

  if (!match || !summary) {
    return <div className="p-8 text-center text-slate-500">Loading summary…</div>;
  }

  const sortedEvents = [...match.events].sort((a, b) => a.matchClockMs - b.matchClockMs);
  const goalEvents = match.events.filter((e) => e.type === 'GOAL');
  const subEvents = match.events.filter((e) => e.type === 'SUBSTITUTION');

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Match summary</h1>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Back to dashboard
        </Button>
      </div>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-semibold">
          {match.teamName || 'Us'} {summary.teamScore} – {summary.opponentScore} {match.opponentName || 'Opponent'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {match.date} {match.title ? `· ${match.title}` : ''} · Final time {formatClock(summary.matchClockMs)}
        </p>
      </section>

      <section className="mt-4">
        <h3 className="text-lg font-semibold">Player statistics</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Players flagged below are shown as a planning aid — substantially under the team's average field time this
          match, not a judgment of effort or ability.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left dark:border-slate-600">
                <th className="py-2">Player</th>
                <th>Status</th>
                <th>Minutes played</th>
                <th>Minutes benched</th>
                <th>Goals</th>
                <th>Assists</th>
                <th>Subs in/out</th>
              </tr>
            </thead>
            <tbody>
              {summary.summaries.map((s) => {
                const belowAverage = summary.belowAveragePlayerIds.includes(s.playerId);
                const player = playersById.get(s.playerId);
                return (
                  <tr key={s.playerId} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="flex items-center gap-2 py-2">
                      {player && <PlayerAvatar player={player} size="sm" />}
                      {jerseyLabel(s.jerseyNumber)} {s.playerName}
                      {belowAverage && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          Below avg. playing time
                        </span>
                      )}
                    </td>
                    <td className="capitalize">{s.status.replace('_', ' ')}</td>
                    <td className="tabular-nums">{(s.totalFieldMs / 60000).toFixed(1)}</td>
                    <td className="tabular-nums">{(s.totalBenchMs / 60000).toFixed(1)}</td>
                    <td className="tabular-nums">{s.goals}</td>
                    <td className="tabular-nums">{s.assists}</td>
                    <td className="tabular-nums">
                      {s.subsIn} / {s.subsOut}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-500">Team average field time: {(summary.averageFieldMs / 60000).toFixed(1)} min.</p>
      </section>

      <section className="mt-4">
        <h3 className="text-lg font-semibold">Goals ({goalEvents.length}) &amp; substitutions ({subEvents.length})</h3>
      </section>

      <section className="mt-2">
        <h3 className="text-lg font-semibold">Event timeline</h3>
        <ol className="mt-2 max-h-96 space-y-1 overflow-y-auto">
          {sortedEvents.map((event) => (
            <li key={event.id} className="flex gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700">
              <span className="tabular-nums text-slate-500">{formatClock(eventDisplayMs(match.events, event))}</span>
              <span>{describeEvent(event, playersById, match.settings.formationId)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => exportPlayerSummaryAsCsv(`${match.date}-${match.opponentName || 'opponent'}`, summary.summaries)}
        >
          Export player summary (CSV)
        </Button>
        <Button variant="secondary" onClick={() => navigate('/settings')}>
          Full backup / export…
        </Button>
      </section>
    </div>
  );
}
