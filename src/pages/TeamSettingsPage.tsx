import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '../state/teamStore';
import { useRosterStore } from '../state/rosterStore';
import { useMatchStore } from '../state/matchStore';
import { clampMinGirls, DEFAULT_MIN_GIRLS_ON_FIELD } from '../lib/coed';
import { Button } from '../components/common/Button';
import { Dialog } from '../components/common/Dialog';
import { TeamPhotoControls } from '../components/layout/TeamPhotoControls';

export function TeamSettingsPage() {
  const navigate = useNavigate();
  const { teams, activeTeamId, loaded, load, renameTeam, setCoed, setTeamPhoto, deleteTeam } = useTeamStore();
  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;

  const [name, setName] = useState('');
  const [coed, setCoedDraft] = useState(false);
  const [minGirls, setMinGirls] = useState(String(DEFAULT_MIN_GIRLS_ON_FIELD));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  // Re-seed the form whenever the manager switches teams.
  useEffect(() => {
    if (!activeTeam) return;
    setName(activeTeam.name);
    setCoedDraft(Boolean(activeTeam.coed));
    setMinGirls(String(clampMinGirls(activeTeam.minGirlsOnField)));
    setPhotoFile(null);
    setRemovePhoto(false);
    setError(null);
    setSaved(false);
  }, [activeTeam?.id, activeTeam?.name, activeTeam?.coed, activeTeam?.minGirlsOnField]);

  if (!activeTeam) {
    return <div className="p-8 text-center text-slate-500">Loading team…</div>;
  }

  async function handleSave() {
    if (!activeTeam) return;
    setError(null);
    if (name.trim() !== activeTeam.name) {
      const result = await renameTeam(activeTeam.id, name);
      if (result.error) {
        setError(result.error);
        return;
      }
    }
    if (coed !== Boolean(activeTeam.coed) || clampMinGirls(Number(minGirls)) !== clampMinGirls(activeTeam.minGirlsOnField)) {
      const result = await setCoed(activeTeam.id, coed, Number(minGirls));
      if (result.error) {
        setError(result.error);
        return;
      }
    }
    if (removePhoto) await setTeamPhoto(activeTeam.id, null);
    else if (photoFile) await setTeamPhoto(activeTeam.id, photoFile);
    setPhotoFile(null);
    setRemovePhoto(false);
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Team settings</h1>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Back to dashboard
        </Button>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        These settings apply to {activeTeam.name}. Players live in the roster.
      </p>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <label htmlFor="team-name" className="block text-sm font-medium">
          Team name
        </label>
        <input
          id="team-name"
          className="input mt-1"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />

        <TeamPhotoControls
          name={name || activeTeam.name}
          teamId={activeTeam.id}
          photoId={activeTeam.photoId}
          file={photoFile}
          remove={removePhoto}
          onFile={(file) => {
            setPhotoFile(file);
            setRemovePhoto(false);
            setSaved(false);
          }}
          onRemove={() => {
            setPhotoFile(null);
            setRemovePhoto(true);
            setSaved(false);
          }}
        />
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-base font-semibold">Co-ed rules</h2>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={coed}
            onChange={(e) => {
              setCoedDraft(e.target.checked);
              setSaved(false);
            }}
          />
          This is a co-ed team
        </label>
        {coed && (
          <div className="mt-3">
            <label htmlFor="team-min-girls" className="block text-sm font-medium">
              Girls required on the field
            </label>
            <input
              id="team-min-girls"
              type="number"
              min={1}
              max={11}
              className="input mt-1 w-24"
              value={minGirls}
              onChange={(e) => {
                setMinGirls(e.target.value);
                setSaved(false);
              }}
            />
            <p className="mt-1 text-xs text-slate-500">
              A guy cannot go on the field until this many girls are already out. Each player then needs a gender in the
              roster.
            </p>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="mt-4 rounded bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">
          Team settings saved.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={handleSave}>
          Save team settings
        </Button>
      </div>

      <section className="mt-8 rounded-xl border border-red-200 p-4 dark:border-red-900">
        <h2 className="text-base font-semibold">Delete this team</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Removes the team's players, photos, lineups, and matches from this device.
        </p>
        <Button
          variant="danger"
          className="mt-3"
          disabled={teams.length <= 1}
          onClick={() => setConfirmDelete(true)}
        >
          Delete team
        </Button>
        {teams.length <= 1 && <p className="mt-2 text-xs text-slate-500">You need at least one team.</p>}
      </section>

      <Dialog
        open={confirmDelete}
        title={`Delete ${activeTeam.name}?`}
        description="This cannot be undone."
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const result = await deleteTeam(activeTeam.id);
                setConfirmDelete(false);
                if (!result.error) {
                  await useRosterStore.getState().load();
                  await useMatchStore.getState().loadAllMatches();
                  navigate('/');
                }
              }}
            >
              Delete team
            </Button>
          </>
        }
      >
        <p className="text-sm">Every player, lineup, and match for this team is removed from this device.</p>
      </Dialog>
    </div>
  );
}
