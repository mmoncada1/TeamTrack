import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '../state/matchStore';
import { useTeamStore } from '../state/teamStore';
import { deriveMatchState } from '../lib/matchEngine';
import { Button } from '../components/common/Button';
import type { Match, MatchStatus } from '../types';

const STATUS_LABEL: Record<MatchStatus, string> = {
  setup: 'In setup',
  in_progress: 'Live',
  paused: 'Paused',
  half_time: 'Half-time',
  ended: 'Final',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { allMatches, loadAllMatches, deleteMatchById } = useMatchStore();
  const activeTeam = useTeamStore((s) => s.teams.find((team) => team.id === s.activeTeamId) ?? null);

  useEffect(() => {
    loadAllMatches();
  }, [loadAllMatches]);

  const withStatus = useMemo(
    () =>
      allMatches
        .filter((match) => !activeTeam || match.teamId === activeTeam.id)
        .map((m) => ({ match: m, status: deriveMatchState(m).status })),
    [allMatches, activeTeam],
  );

  const active = withStatus.filter((m) => m.status !== 'ended' && m.status !== 'setup');
  const drafts = withStatus.filter((m) => m.status === 'setup');
  const history = withStatus.filter((m) => m.status === 'ended');

  function goTo(match: Match, status: MatchStatus) {
    if (status === 'setup') navigate(`/match/${match.id}/setup`);
    else if (status === 'ended') navigate(`/match/${match.id}/summary`);
    else navigate(`/match/${match.id}/live`);
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{activeTeam ? activeTeam.name : 'TeamTrack'}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/roster')}>
            Manage roster
          </Button>
          <Button variant="primary" onClick={() => navigate('/match/new')}>
            + New match
          </Button>
        </div>
      </div>

      {active.length > 0 && (
        <Section title="Resume active match">
          {active.map(({ match, status }) => (
            <MatchRow key={match.id} match={match} status={status} onOpen={() => goTo(match, status)} onDelete={() => deleteMatchById(match.id)} />
          ))}
        </Section>
      )}

      {drafts.length > 0 && (
        <Section title="Unfinished setup">
          {drafts.map(({ match, status }) => (
            <MatchRow key={match.id} match={match} status={status} onOpen={() => goTo(match, status)} onDelete={() => deleteMatchById(match.id)} />
          ))}
        </Section>
      )}

      <Section title="Match history">
        {history.length === 0 && <p className="text-sm text-slate-500">No completed matches yet.</p>}
        {history.map(({ match, status }) => (
          <MatchRow key={match.id} match={match} status={status} onOpen={() => goTo(match, status)} onDelete={() => deleteMatchById(match.id)} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function MatchRow({
  match,
  status,
  onOpen,
  onDelete,
}: {
  match: Match;
  status: MatchStatus;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <button onClick={onOpen} className="flex-1 text-left">
        <div className="font-semibold">
          {match.teamName || 'Us'} vs {match.opponentName || 'Opponent'}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {match.date} · {STATUS_LABEL[status]} · {match.settings.format}
        </div>
      </button>
      <Button size="sm" variant="ghost" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}
