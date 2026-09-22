import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/roster', label: 'Roster' },
  { to: '/settings', label: 'Settings' },
];

export function AppShell() {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to main content
      </a>
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 p-3" aria-label="Main navigation">
          <span className="mr-4 flex items-center gap-2 font-bold">
            <img src="/field-icon.svg" alt="" className="h-6 w-6" aria-hidden />
            TeamTrack
          </span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
