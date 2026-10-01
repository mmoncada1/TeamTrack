import { lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { RosterPage } from './pages/RosterPage';
import { LineupsPage } from './pages/LineupsPage';
import { MatchHistoryPage } from './pages/MatchHistoryPage';
import { TeamSettingsPage } from './pages/TeamSettingsPage';
import { WhiteboardPage } from './pages/WhiteboardPage';
import { MatchSetupPage } from './pages/MatchSetupPage';
import { LiveMatchPage } from './pages/LiveMatchPage';
import { MatchSummaryPage } from './pages/MatchSummaryPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppSettingsStore } from './state/appSettingsStore';
import { ensureDatabaseReady } from './db/db';
import { SportBoundary, SportGate } from './components/layout/SportBoundary';
const FootballDashboard = lazy(() => import('./football/FootballDashboard').then(m => ({ default: m.FootballDashboard })));
const FormationsPage = lazy(() => import('./football/FormationsPage').then(m => ({ default: m.FormationsPage })));
const PlaybookPage = lazy(() => import('./football/PlaybookPage').then(m => ({ default: m.PlaybookPage })));
const PlayEditorPage = lazy(() => import('./football/PlayEditorPage').then(m => ({ default: m.PlayEditorPage })));
const DrivePlansPage = lazy(() => import('./football/DrivePlansPage').then(m => ({ default: m.DrivePlansPage })));
const FootballWhiteboardPage = lazy(() => import('./football/FootballWhiteboardPage').then(m => ({ default: m.FootballWhiteboardPage })));

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
          <Route path="/" element={<SportBoundary soccer={<DashboardPage />} football={<FootballDashboard />} />} />
          <Route path="/roster" element={<RosterPage />} />
          <Route path="/lineups" element={<SportGate sport="soccer"><LineupsPage /></SportGate>} />
          <Route path="/matches" element={<SportGate sport="soccer"><MatchHistoryPage /></SportGate>} />
          <Route path="/football/formations" element={<SportGate sport="football"><FormationsPage /></SportGate>} />
          <Route path="/football/playbook" element={<SportGate sport="football"><PlaybookPage /></SportGate>} />
          <Route path="/football/plays/:id" element={<SportGate sport="football"><PlayEditorPage /></SportGate>} />
          <Route path="/football/drives" element={<SportGate sport="football"><DrivePlansPage /></SportGate>} />
          <Route path="/team" element={<Navigate to="/team/settings" replace />} />
          <Route path="/team/settings" element={<TeamSettingsPage />} />
          <Route path="/whiteboard" element={<SportBoundary soccer={<WhiteboardPage />} football={<FootballWhiteboardPage />} />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/match/new" element={<SportGate sport="soccer"><MatchSetupPage /></SportGate>} />
          <Route path="/match/:id/setup" element={<SportGate sport="soccer"><MatchSetupPage /></SportGate>} />
          <Route path="/match/:id/live" element={<SportGate sport="soccer"><LiveMatchPage /></SportGate>} />
          <Route path="/match/:id/summary" element={<SportGate sport="soccer"><MatchSummaryPage /></SportGate>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
