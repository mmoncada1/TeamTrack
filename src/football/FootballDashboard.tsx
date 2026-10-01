import { Link } from 'react-router-dom';
import { useFootballData } from './useFootballData';

export function FootballDashboard() {
  const { team, players = [], formations = [], plays = [], drives = [] } = useFootballData();
  const steps = [
    {
      to: '/roster',
      name: 'Roster',
      count: players.length,
      detail: 'Add your flag football players.',
    },
    {
      to: '/football/formations',
      name: 'Formations',
      count: formations.length,
      detail: 'Position seven players and designate a QB and snapper.',
    },
    {
      to: '/football/playbook',
      name: 'Playbook',
      count: plays.length,
      detail: 'Create a play or load an editable starter concept.',
    },
    {
      to: '/football/drives',
      name: 'Drive plans',
      count: drives.length,
      detail: 'Arrange plays into an ordered call sheet.',
    },
    { to: '/whiteboard', name: 'Whiteboard', detail: 'Draw freely on a blank football field.' },
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">{team?.name} · 7v7 flag football</h1>
      <p className="text-slate-500">
        Build your roster, set a formation, design plays, and plan your next drive.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="rounded-xl border p-5 hover:border-emerald-500 dark:border-slate-700"
          >
            <h2 className="text-lg font-bold">
              {s.name}
              {s.count !== undefined ? ` (${s.count})` : ''}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{s.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
