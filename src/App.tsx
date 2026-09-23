import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { RosterPage } from './pages/RosterPage';
import { LineupsPage } from './pages/LineupsPage';
import { MatchHistoryPage } from './pages/MatchHistoryPage';
import { TeamManagementPage } from './pages/TeamManagementPage';
import { TeamSettingsPage } from './pages/TeamSettingsPage';
import { WhiteboardPage } from './pages/WhiteboardPage';
import { MatchSetupPage } from './pages/MatchSetupPage';
import { LiveMatchPage } from './pages/LiveMatchPage';
import { MatchSummaryPage } from './pages/MatchSummaryPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppSettingsStore } from './state/appSettingsStore';
import { ensureDatabaseReady } from './db/db';

function App() {
  const settings = useAppSettingsStore((s) => s.settings);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  }, [settings.theme, settings.reducedMotion]);

  useEffect(() => {
    ensureDatabaseReady().then((result) => {
      if (!result.ok) setDbError(result.error ?? 'Unknown error opening local database.');
    });
  }, []);

  if (dbError) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold text-red-700">Could not open local storage</h1>
        <p className="mt-2 text-sm text-slate-600">{dbError}</p>
        <p className="mt-2 text-sm text-slate-600">
          Try reloading the page. If this persists, your browser's storage may be full, in private-browsing mode, or
          blocked by an extension.
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/roster" element={<RosterPage />} />
          <Route path="/lineups" element={<LineupsPage />} />
          <Route path="/matches" element={<MatchHistoryPage />} />
          <Route path="/team" element={<TeamManagementPage />} />
          <Route path="/team/settings" element={<TeamSettingsPage />} />
          <Route path="/whiteboard" element={<WhiteboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/match/new" element={<MatchSetupPage />} />
          <Route path="/match/:id/setup" element={<MatchSetupPage />} />
          <Route path="/match/:id/live" element={<LiveMatchPage />} />
          <Route path="/match/:id/summary" element={<MatchSummaryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
