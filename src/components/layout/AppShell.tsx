import { NavLink, Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import clsx from 'clsx';
import { TeamSwitcher } from './TeamSwitcher';
import { useTeamStore } from '../../state/teamStore';
import { teamSport } from '../../lib/sports';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/roster', label: 'Roster' },
  { to: '/lineups', label: 'Lineups' },
  { to: '/matches', label: 'Matches' },
  { to: '/team/settings', label: 'Team' },
  { to: '/whiteboard', label: 'Whiteboard' },
  { to: '/settings', label: 'Settings' },
];

export function AppShell() {
  const team = useTeamStore(s => s.teams.find(t => t.id === s.activeTeamId));
  const navItems = teamSport(team) === 'football' ? [
    { to: '/', label: 'Dashboard' }, { to: '/roster', label: 'Roster' },
    { to: '/football/formations', label: 'Formations' }, { to: '/football/playbook', label: 'Playbook' },
    { to: '/football/drives', label: 'Drive plans' }, { to: '/whiteboard', label: 'Whiteboard' },
    { to: '/team/settings', label: 'Team' }, { to: '/settings', label: 'Settings' },
  ] : NAV_ITEMS;
  return (
    <div className="flex h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to main content
      </a>
      <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-3 py-2" aria-label="Main navigation">
          <span className="mr-3 flex items-center gap-1.5 text-sm font-bold">
            <img src="/field-icon.svg" alt="" className="h-5 w-5" aria-hidden />
            TeamTrack
          </span>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'min-h-[32px] rounded-lg px-2.5 py-1.5 text-sm font-medium',
                  isActive
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
          <TeamSwitcher />
        </nav>
      </header>
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
        <Suspense fallback={<p className="p-4">Loading…</p>}><Outlet key={team?.id} /></Suspense>
      </main>
    </div>
  );
}
