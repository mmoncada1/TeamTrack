import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettingsStore } from '../state/appSettingsStore';
import { useRosterStore } from '../state/rosterStore';
import { useMatchStore } from '../state/matchStore';
import { useTeamStore } from '../state/teamStore';
import { db } from '../db/db';
import * as repo from '../db/repository';
import { exportBackupAsJson, validateBackup, type BackupValidationResult } from '../lib/exportImport';
import { buildDemoRoster } from '../lib/demoData';
import { Button } from '../components/common/Button';
import { Dialog } from '../components/common/Dialog';

export function SettingsPage() {
  const navigate = useNavigate();
  const settings = useAppSettingsStore((s) => s.settings);
  const { toggleTheme, setAlertSoundEnabled, setReducedMotion, setFieldLocked } = useAppSettingsStore();
  const roster = useRosterStore();
  const matchStore = useMatchStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<BackupValidationResult | null>(null);
  const [confirmResetApp, setConfirmResetApp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    const teams = await repo.listTeams();
    const players = await repo.listPlayers();
    const matches = await repo.listMatches();
    const photos = await repo.listPhotos();
    const teamPhotos = await repo.listTeamPhotos();
    await exportBackupAsJson(teams, players, matches, settings, photos, teamPhotos);
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      setPendingImport(validateBackup(parsed));
    } catch {
      setPendingImport({ valid: false, errors: ['File is not valid JSON.'] });
    }
    e.target.value = '';
  }

  async function confirmImport() {
    if (!pendingImport?.backup) return;
    await repo.replaceAllData(
      pendingImport.backup.teams,
      pendingImport.backup.players,
      pendingImport.backup.matches,
      pendingImport.backup.photos,
      pendingImport.backup.teamPhotos,
    );
    await useTeamStore.getState().load();
    await roster.load();
    await matchStore.loadAllMatches();
    setPendingImport(null);
    setMessage('Backup imported successfully.');
  }

  async function handleResetApp() {
    await db.teams.clear();
    await db.players.clear();
    await db.photos.clear();
    await db.teamPhotos.clear();
    await db.matches.clear();
    localStorage.clear();
    setConfirmResetApp(false);
    window.location.reload();
  }

  async function handleLoadDemoRoster() {
    const teamId = useTeamStore.getState().activeTeamId;
    if (!teamId) {
      setMessage('Choose a team before loading the demo roster.');
      return;
    }
    const demo = buildDemoRoster(teamId);
    await Promise.all(demo.map((p) => repo.upsertPlayer(p)));
    await roster.load();
    setMessage(`Loaded ${demo.length} demo players.`);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {message && (
        <p role="status" className="mt-3 rounded bg-emerald-100 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {message}
        </p>
      )}

      <section className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="font-semibold">Appearance</h2>
        <label className="flex items-center justify-between">
          <span>Dark theme</span>
          <input type="checkbox" checked={settings.theme === 'dark'} onChange={toggleTheme} />
        </label>
        <label className="flex items-center justify-between">
          <span>Reduce motion</span>
          <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between">
          <span>Lock field layout (all matches)</span>
          <input type="checkbox" checked={settings.fieldLocked} onChange={(e) => setFieldLocked(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between">
          <span>Play sound on new alerts</span>
          <input type="checkbox" checked={settings.alertSoundEnabled} onChange={(e) => setAlertSoundEnabled(e.target.checked)} />
        </label>
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="font-semibold">Backup &amp; restore</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Export a full JSON backup of your roster and match history, or import a previous backup.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleExport}>
            Export JSON backup
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Import JSON backup…
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChosen} />
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="font-semibold">Sample data</h2>
        <Button variant="secondary" onClick={handleLoadDemoRoster}>
          Load demo roster
        </Button>
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-red-200 bg-white p-4 dark:border-red-800 dark:bg-slate-800">
        <h2 className="font-semibold text-red-700 dark:text-red-300">Danger zone</h2>
        <Button variant="danger" onClick={() => setConfirmResetApp(true)}>
          Reset all app data…
        </Button>
      </section>

      <div className="mt-6">
        <Button variant="ghost" onClick={() => navigate('/')}>
          Back to dashboard
        </Button>
      </div>

      <Dialog
        open={!!pendingImport}
        title="Import backup?"
        description="This replaces all current players and matches on this device."
        onClose={() => setPendingImport(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!pendingImport?.valid} onClick={confirmImport}>
              Replace local data
            </Button>
          </>
        }
      >
        {pendingImport && (
          <div className="space-y-2 text-sm">
            {pendingImport.valid ? (
              <p>
                Found {pendingImport.backup?.players.length ?? 0} player(s), {pendingImport.backup?.matches.length ?? 0}{' '}
                match(es), {pendingImport.backup?.photos.length ?? 0} player photo(s), and{' '}
                {pendingImport.backup?.teamPhotos.length ?? 0} team photo(s) in this backup.
              </p>
            ) : (
              <p className="text-red-600">This file could not be imported.</p>
            )}
            {pendingImport.errors.map((e, i) => (
              <p key={i} className="text-amber-700 dark:text-amber-300">
                {e}
              </p>
            ))}
          </div>
        )}
      </Dialog>

      <Dialog
        open={confirmResetApp}
        title="Reset all app data?"
        description="This permanently deletes every player, photo, and match stored on this device, and cannot be undone."
        onClose={() => setConfirmResetApp(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmResetApp(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleResetApp}>
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-sm">Consider exporting a backup first.</p>
      </Dialog>
    </div>
  );
}
