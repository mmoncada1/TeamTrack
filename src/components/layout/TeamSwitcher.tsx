import { useEffect, useState } from 'react';
import { useTeamStore } from '../../state/teamStore';
import { useRosterStore } from '../../state/rosterStore';
import { useMatchStore } from '../../state/matchStore';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';
import { DEFAULT_MIN_GIRLS_ON_FIELD } from '../../lib/coed';
import { TeamAvatar } from '../common/TeamAvatar';
import { TeamPhotoControls } from './TeamPhotoControls';

export function TeamSwitcher() {
  const { teams, activeTeamId, loaded, load, setActiveTeam, createTeam, renameTeam, setTeamPhoto, deleteTeam } =
    useTeamStore();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState('');
  const [coed, setCoed] = useState(false);
  const [minGirls, setMinGirls] = useState(String(DEFAULT_MIN_GIRLS_ON_FIELD));
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const active = teams.find((team) => team.id === activeTeamId);

  async function refreshAfterTeamChange() {
    await useRosterStore.getState().load();
    await useMatchStore.getState().loadAllMatches();
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {active && <TeamAvatar team={active} size="sm" />}
      <label htmlFor="active-team" className="sr-only">
        Active team
      </label>
      <select
        id="active-team"
        className="min-h-[32px] rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        value={activeTeamId ?? ''}
        onChange={(e) => {
          setActiveTeam(e.target.value);
          refreshAfterTeamChange();
        }}
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setName('');
          setCoed(false);
          setMinGirls(String(DEFAULT_MIN_GIRLS_ON_FIELD));
          setPhotoFile(null);
          setRemovePhoto(false);
          setError(null);
          setCreating(true);
        }}
      >
        New team
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={!active}
        onClick={() => {
          setName(active?.name ?? '');
          setPhotoFile(null);
          setRemovePhoto(false);
          setError(null);
          setRenaming(true);
        }}
      >
        Rename
      </Button>
      <Button size="sm" variant="ghost" disabled={teams.length <= 1} onClick={() => setConfirmDelete(true)}>
        Delete
      </Button>

      <Dialog
        open={creating}
        title="New team"
        description="Each team has its own roster and matches."
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const result = await createTeam(name, {
                  coed,
                  minGirlsOnField: Number(minGirls),
                });
                if (result.error) {
                  setError(result.error);
                  return;
                }
                if (result.teamId && photoFile) await setTeamPhoto(result.teamId, photoFile);
                setCreating(false);
                await refreshAfterTeamChange();
              }}
            >
              Create team
            </Button>
          </>
        }
      >
        <label htmlFor="new-team-name" className="block text-sm font-medium">
          Team name
        </label>
        <input
          id="new-team-name"
          className="input mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={coed} onChange={(e) => setCoed(e.target.checked)} />
          Co-ed team
        </label>
        {coed && (
          <div className="mt-3">
            <label htmlFor="new-team-min-girls" className="block text-sm font-medium">
              Girls required on the field
            </label>
            <input
              id="new-team-min-girls"
              type="number"
              min={1}
              max={11}
              className="input mt-1 w-24"
              value={minGirls}
              onChange={(e) => setMinGirls(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              The live match warns you when fewer girls than this are on the field.
            </p>
          </div>
        )}
        <TeamPhotoControls
          name={name}
          file={photoFile}
          remove={removePhoto}
          onFile={(file) => {
            setPhotoFile(file);
            setRemovePhoto(false);
          }}
          onRemove={() => {
            setPhotoFile(null);
            setRemovePhoto(true);
          }}
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </Dialog>

      <Dialog
        open={renaming}
        title="Rename team"
        onClose={() => setRenaming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!active) return;
                const result = await renameTeam(active.id, name);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                if (removePhoto) await setTeamPhoto(active.id, null);
                else if (photoFile) await setTeamPhoto(active.id, photoFile);
                setRenaming(false);
              }}
            >
              Save name
            </Button>
          </>
        }
      >
        <label htmlFor="rename-team-name" className="block text-sm font-medium">
          Team name
        </label>
        <input
          id="rename-team-name"
          className="input mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {active && (
          <TeamPhotoControls
            name={name || active.name}
            teamId={active.id}
            photoId={active.photoId}
            file={photoFile}
            remove={removePhoto}
            onFile={(file) => {
              setPhotoFile(file);
              setRemovePhoto(false);
            }}
            onRemove={() => {
              setPhotoFile(null);
              setRemovePhoto(true);
            }}
          />
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </Dialog>

      <Dialog
        open={confirmDelete}
        title={`Delete ${active?.name ?? 'this team'}?`}
        description="This removes that team's players, photos, and matches from this device."
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!active) return;
                const result = await deleteTeam(active.id);
                setConfirmDelete(false);
                if (!result.error) await refreshAfterTeamChange();
              }}
            >
              Delete team
            </Button>
          </>
        }
      >
        <p className="text-sm">You need at least one team, so the last team cannot be deleted.</p>
      </Dialog>
    </div>
  );
}
