import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Player, PositionGroup } from '../types';
import { PLAYER_GENDER_LABELS, POSITION_GROUP_LABELS } from '../types';
import { useRosterStore } from '../state/rosterStore';
import { useTeamStore } from '../state/teamStore';
import { clampMinGirls } from '../lib/coed';
import { PlayerForm } from '../components/roster/PlayerForm';
import { Dialog } from '../components/common/Dialog';
import { Button } from '../components/common/Button';
import { PlayerAvatar } from '../components/common/PlayerAvatar';
import { TeamAvatar } from '../components/common/TeamAvatar';
import { jerseyLabel } from '../lib/playerSort';
import { playerPositionGroups, positionNames } from '../lib/playerPositions';

export function RosterPage() {
  const { players, loaded, load, addPlayer, updatePlayer, deletePlayer } = useRosterStore();
  const activeTeam = useTeamStore((s) => s.teams.find((team) => team.id === s.activeTeamId) ?? null);
  const teamPlayers = players.filter((player) => !activeTeam || player.teamId === activeTeam.id);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<PositionGroup | 'ALL'>('ALL');

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const filtered = useMemo(() => {
    return teamPlayers.filter((p) => {
      if (groupFilter !== 'ALL' && !playerPositionGroups(p).includes(groupFilter)) return false;
      if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [teamPlayers, search, groupFilter]);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {activeTeam && <TeamAvatar team={activeTeam} size="md" />}
          <div>
            <h1 className="text-2xl font-bold">{activeTeam ? `${activeTeam.name} roster` : 'Roster'}</h1>
            {activeTeam && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {activeTeam.coed
                  ? `Co-ed · at least ${clampMinGirls(activeTeam.minGirlsOnField)} girls on the field`
                  : 'Not a co-ed team'}
                <Link to="/team/settings" className="ml-2 font-medium text-emerald-700 underline dark:text-emerald-300">
                  Team settings
                </Link>
              </p>
            )}
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditingPlayer(null);
            setFormOpen(true);
          }}
        >
          + Add player
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="roster-search" className="sr-only">
            Search players
          </label>
          <input
            id="roster-search"
            type="search"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
        <div>
          <label htmlFor="roster-filter" className="sr-only">
            Filter by position group
          </label>
          <select
            id="roster-filter"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as PositionGroup | 'ALL')}
            className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="ALL">All positions</option>
            {(['GK', 'DEF', 'MID', 'FWD'] as PositionGroup[]).map((g) => (
              <option key={g} value={g}>
                {POSITION_GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {teamPlayers.length === 0 && loaded && (
        <p className="mt-8 text-center text-slate-500 dark:text-slate-400">
          No players yet. Add your first player to get started.
        </p>
      )}

      <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {filtered.map((player) => (
          <li key={player.id} className="flex items-center gap-3 p-3">
            <PlayerAvatar player={player} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{jerseyLabel(player.jerseyNumber)}</span>
                <span>{player.name}</span>
                {player.availability === 'unavailable' && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    Unavailable
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {positionNames(player)}
                {activeTeam?.coed && (
                  <>
                    {' · '}
                    {player.gender ? (
                      PLAYER_GENDER_LABELS[player.gender]
                    ) : (
                      <span className="font-medium text-amber-700 dark:text-amber-300">Set gender</span>
                    )}
                  </>
                )}
                {player.notes ? ` · ${player.notes}` : ''}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingPlayer(player);
                setFormOpen(true);
              }}
            >
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(player)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={formOpen}
        title={editingPlayer ? `Edit ${editingPlayer.name}` : 'Add player'}
        onClose={() => setFormOpen(false)}
      >
        <PlayerForm
          key={editingPlayer?.id ?? 'new'}
          initial={editingPlayer ?? undefined}
          requireGender={Boolean(activeTeam?.coed)}
          submitLabel={editingPlayer ? 'Save changes' : 'Add player'}
          onCancel={() => setFormOpen(false)}
          onSubmit={async (input) => {
            const result = editingPlayer ? await updatePlayer(editingPlayer.id, input) : await addPlayer(input);
            if (result.errors.length === 0) setFormOpen(false);
            return result;
          }}
        />
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        title="Delete player?"
        description={
          deleteTarget
            ? `This permanently removes ${deleteTarget.name} and their photo from this device. Past match history that references them is kept.`
            : undefined
        }
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleteTarget) await deletePlayer(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">This action cannot be undone.</p>
      </Dialog>
    </div>
  );
}
