import { useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '../state/matchStore';
import { useTeamStore } from '../state/teamStore';
import { useRosterStore } from '../state/rosterStore';
import { useLineupStore } from '../state/lineupStore';
import { deriveMatchState } from '../lib/matchEngine';
import { Button } from '../components/common/Button';
import { TeamAvatar } from '../components/common/TeamAvatar';

export function DashboardPage() {
  const navigate = useNavigate();
  const { allMatches, loadAllMatches } = useMatchStore();
  const activeTeam = useTeamStore((s) => s.teams.find((team) => team.id === s.activeTeamId) ?? null);
  const roster = useRosterStore();
  const lineupStore = useLineupStore();

  useEffect(() => {
    loadAllMatches();
  }, [loadAllMatches]);

  useEffect(() => {
    if (!roster.loaded) roster.load();
  }, [roster.loaded, roster.load]);

  useEffect(() => {
    if (!lineupStore.loaded) lineupStore.load();
  }, [lineupStore.loaded, lineupStore.load]);

  const teamMatches = useMemo(
    () => allMatches.filter((match) => !activeTeam || match.teamId === activeTeam.id),
    [allMatches, activeTeam],
  );
  const inProgress = teamMatches
    .map((match) => ({ match, status: deriveMatchState(match).status }))
    .find(({ status }) => status !== 'ended' && status !== 'setup');

  const playerCount = roster.players.filter((player) => !activeTeam || player.teamId === activeTeam.id).length;
  const lineupCount = lineupStore.lineups.filter((lineup) => !activeTeam || lineup.teamId === activeTeam.id).length;
  const playedCount = teamMatches.filter((match) => deriveMatchState(match).status === 'ended').length;

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        {activeTeam && <TeamAvatar team={activeTeam} size="md" />}
        <div>
          <h1 className="text-2xl font-bold">{activeTeam ? activeTeam.name : 'TeamTrack'}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Team manager</p>
        </div>
      </div>

      {inProgress && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
          <div>
            <p className="font-semibold">Match in progress</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {inProgress.match.teamName || 'Us'} vs {inProgress.match.opponentName || 'Opponent'}
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate(`/match/${inProgress.match.id}/live`)}>
            Resume match
          </Button>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <HubCard
          title="Create new match"
          detail="Set up an opponent, kickoff, and starting lineup."
          accent
          onClick={() => navigate('/match/new')}
        />
        <HubCard
          title="Roster"
          detail={`${playerCount} player${playerCount === 1 ? '' : 's'} on the team.`}
          onClick={() => navigate('/roster')}
        />
        <HubCard
          title="Lineups"
          detail={
            lineupCount > 0
              ? `${lineupCount} saved lineup${lineupCount === 1 ? '' : 's'} ready to use.`
              : 'Build a starting lineup before match day.'
          }
          onClick={() => navigate('/lineups')}
        />
        <HubCard
          title="Match history"
          detail={
            playedCount > 0
              ? `${playedCount} completed match${playedCount === 1 ? '' : 'es'}.`
              : 'Results and recaps show up here.'
          }
          onClick={() => navigate('/matches')}
        />
        <HubCard
          title="Team management"
          detail="Team name, photo, and co-ed rules."
          onClick={() => navigate('/team/settings')}
        />
        <HubCard
          title="Whiteboard"
          detail="Draw tactics on a pitch."
          onClick={() => navigate('/whiteboard')}
        />
      </div>
    </div>
  );
}

function HubCard({
  title,
  detail,
  accent,
  onClick,
}: {
  title: string;
  detail: ReactNode;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-colors ${
        accent
          ? 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800'
          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700'
      }`}
    >
      <span className="block text-base font-semibold">{title}</span>
      <span className={`mt-1 block text-sm ${accent ? 'text-emerald-50' : 'text-slate-500 dark:text-slate-400'}`}>
        {detail}
      </span>
    </button>
  );
}
