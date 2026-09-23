import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatchStore } from '../state/matchStore';
import { useRosterStore } from '../state/rosterStore';
import { useTeamStore } from '../state/teamStore';
import { useTeamPhotoUrl } from '../hooks/usePlayerPhoto';
import { buildMatchSummary } from '../lib/stats';
import { formatClock } from '../lib/timer';
import { describeEvent, eventDisplayMs } from '../lib/eventDescriptions';
import { exportPlayerSummaryAsCsv } from '../lib/exportImport';
import { Button } from '../components/common/Button';
import { PlayerAvatar } from '../components/common/PlayerAvatar';
import type { CardEvent, GoalEvent, Match, MatchEvent, Player } from '../types';

export function MatchSummaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useMatchStore();
  const roster = useRosterStore();
  const teams = useTeamStore((s) => s.teams);
  const teamsLoaded = useTeamStore((s) => s.loaded);
  const loadTeams = useTeamStore((s) => s.load);

  useEffect(() => {
    if (!roster.loaded) roster.load();
  }, [roster.loaded, roster.load]);

  useEffect(() => {
    if (!teamsLoaded) loadTeams();
  }, [teamsLoaded, loadTeams]);

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

  const sortedEvents = [...match.events].sort((a, b) => a.matchClockMs - b.matchClockMs || a.timestamp - b.timestamp);
  const recap = buildRecap(match, playersById);
  const ourTeam = teams.find((team) => team.id === match.teamId);
  const teamLabel = match.teamName || 'Us';
  const opponentLabel = match.opponentName || 'Opponent';
  const heading = [match.title, formatMatchDate(match.date)].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Match summary</h1>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Back to dashboard
        </Button>
      </div>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-5 dark:border-slate-700 dark:bg-slate-800 sm:px-8">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
          <p>{heading}</p>
          <p>Full-time</p>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-6">
          <div className="flex items-start justify-start gap-3 sm:gap-5">
            <TeamMark name={teamLabel} tone="us" teamId={ourTeam?.id} photoId={ourTeam?.photoId} />
            <p className="pt-1 text-4xl font-semibold tabular-nums sm:pt-2 sm:text-5xl">{summary.teamScore}</p>
          </div>
          <p className="pt-2 text-2xl font-light text-slate-400 sm:pt-4 sm:text-3xl" aria-hidden>
            –
          </p>
          <div className="flex items-start justify-end gap-3 sm:gap-5">
            <p className="pt-1 text-4xl font-semibold tabular-nums sm:pt-2 sm:text-5xl">{summary.opponentScore}</p>
            <TeamMark name={opponentLabel} tone="opponent" />
          </div>
        </div>

        {recap.ours.length === 0 && recap.theirs.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No goals or cards.</p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-6">
            <RecapList items={recap.ours} align="start" />
            <RecapList items={recap.theirs} align="end" />
          </div>
        )}
      </section>

      <section className="mt-4">
        <h3 className="text-lg font-semibold">Player statistics</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left dark:border-slate-600">
                <th className="py-2">Player</th>
                <th>Minutes played</th>
                <th>Minutes benched</th>
                <th>Goals</th>
                <th>Assists</th>
                <th>Subs in/out</th>
              </tr>
            </thead>
            <tbody>
              {summary.summaries.map((s) => {
                const player = playersById.get(s.playerId);
                return (
                  <tr key={s.playerId} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="flex items-center gap-2 py-2">
                      {player && <PlayerAvatar player={player} size="sm" />}
                      {s.jerseyNumber != null ? `#${s.jerseyNumber} ` : ''}
                      {s.playerName}
                    </td>
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

function formatMatchDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

/** Minute mark in the style of a league scoreboard, including added time. */
function minuteMark(match: Match, event: MatchEvent): string {
  const halfLength = match.settings.halfLengthMinutes;
  const elapsedMs = eventDisplayMs(match.events, event);
  const minuteInPeriod = Math.floor(Math.max(0, elapsedMs) / 60000) + 1;
  const halfIndex = match.events.findIndex((entry) => entry.type === 'HALF_TIME');
  const eventIndex = match.events.findIndex((entry) => entry.id === event.id);
  const secondHalf = halfIndex !== -1 && eventIndex > halfIndex;
  if (!secondHalf) {
    if (halfLength > 0 && minuteInPeriod > halfLength) return `${halfLength}+${minuteInPeriod - halfLength}'`;
    return `${minuteInPeriod}'`;
  }
  const cumulative = halfLength + minuteInPeriod;
  const fullTime = halfLength * 2;
  if (halfLength > 0 && cumulative > fullTime) return `${fullTime}+${cumulative - fullTime}'`;
  return `${cumulative}'`;
}

interface RecapLine {
  id: string;
  text: string;
  minute: string;
  assist?: string;
  card?: 'yellow' | 'red' | 'second';
}

function playerName(playersById: Map<string, Player>, id: string | undefined): string | undefined {
  if (!id) return undefined;
  return playersById.get(id)?.name;
}

function buildRecap(match: Match, playersById: Map<string, Player>): { ours: RecapLine[]; theirs: RecapLine[] } {
  const ordered = [...match.events]
    .filter((event): event is GoalEvent | CardEvent => event.type === 'GOAL' || event.type === 'CARD')
    .sort((a, b) => a.matchClockMs - b.matchClockMs || a.timestamp - b.timestamp);
  const ours: RecapLine[] = [];
  const theirs: RecapLine[] = [];
  for (const event of ordered) {
    const minute = minuteMark(match, event);
    if (event.type === 'CARD') {
      ours.push({
        id: event.id,
        text: playerName(playersById, event.playerId) ?? 'Player',
        minute,
        card: event.secondYellow ? 'second' : event.color,
      });
      continue;
    }
    const scorer = playerName(playersById, event.scorerId);
    const assist = event.assisterId ? playerName(playersById, event.assisterId) : undefined;
    const line: RecapLine = event.isOwnGoal
      ? { id: event.id, text: scorer ? `${scorer} (og)` : 'Own goal', minute }
      : event.team === 'opponent'
        ? { id: event.id, text: 'Goal', minute }
        : { id: event.id, text: scorer ?? 'Goal', minute, assist };
    if (event.isOwnGoal || event.team === 'opponent') theirs.push(line);
    else ours.push(line);
  }
  return { ours, theirs };
}

function TeamMark({
  name,
  tone,
  teamId,
  photoId,
}: {
  name: string;
  tone: 'us' | 'opponent';
  teamId?: string;
  photoId?: string;
}) {
  const photoUrl = useTeamPhotoUrl(tone === 'us' ? teamId : undefined, tone === 'us' ? photoId : undefined);
  const circle = tone === 'us' ? 'bg-emerald-600 text-white' : 'bg-sky-700 text-white';
  return (
    <div className="flex w-16 flex-col items-center text-center sm:w-28">
      {photoUrl ? (
        <img src={photoUrl} alt={`Photo of ${name}`} className="h-12 w-12 rounded-full object-cover sm:h-16 sm:w-16" />
      ) : (
        <span className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold sm:h-16 sm:w-16 sm:text-base ${circle}`}>
          {initials(name)}
        </span>
      )}
      <p className="mt-2 text-sm font-semibold leading-tight">{name}</p>
    </div>
  );
}

function RecapList({ items, align }: { items: RecapLine[]; align: 'start' | 'end' }) {
  if (items.length === 0) return <div />;
  return (
    <ul className={`space-y-1 text-sm ${align === 'end' ? 'text-right' : 'text-left'}`}>
      {items.map((item) => (
        <li key={item.id} className={`flex items-center gap-1.5 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
          {item.card === 'yellow' && <CardChip color="yellow" />}
          {item.card === 'red' && <CardChip color="red" />}
          {item.card === 'second' && (
            <>
              <CardChip color="yellow" />
              <CardChip color="red" />
            </>
          )}
          <span>
            {item.text}
            {item.assist ? <span className="text-slate-500 dark:text-slate-400"> ({item.assist})</span> : null}{' '}
            <span className="text-slate-600 dark:text-slate-300">{item.minute}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CardChip({ color }: { color: 'yellow' | 'red' }) {
  return (
    <span
      className={`inline-block h-3.5 w-2.5 shrink-0 rounded-[2px] ${color === 'red' ? 'bg-red-600' : 'bg-yellow-400'}`}
      aria-label={color === 'red' ? 'Red card' : 'Yellow card'}
    />
  );
}
