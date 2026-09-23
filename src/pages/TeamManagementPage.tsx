import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '../state/teamStore';
import { useRosterStore } from '../state/rosterStore';
import { clampMinGirls } from '../lib/coed';
import { TeamAvatar } from '../components/common/TeamAvatar';

export function TeamManagementPage() {
  const navigate = useNavigate();
  const activeTeam = useTeamStore((s) => s.teams.find((team) => team.id === s.activeTeamId) ?? null);
  const roster = useRosterStore();

  useEffect(() => {
    if (!roster.loaded) roster.load();
  }, [roster.loaded, roster.load]);

  const playerCount = roster.players.filter((player) => !activeTeam || player.teamId === activeTeam.id).length;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        {activeTeam && <TeamAvatar team={activeTeam} size="md" />}
        <div>
          <h1 className="text-2xl font-bold">Team management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {activeTeam ? activeTeam.name : 'No team selected'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SectionCard
          title="Roster"
          detail={`${playerCount} player${playerCount === 1 ? '' : 's'}. Add, edit, and remove players.`}
          onClick={() => navigate('/roster')}
        />
        <SectionCard
          title="Team settings"
          detail={
            activeTeam?.coed
              ? `Name, photo, and co-ed rules. Co-ed with ${clampMinGirls(activeTeam.minGirlsOnField)} girls required.`
              : 'Name, photo, and co-ed rules.'
          }
          onClick={() => navigate('/team/settings')}
        />
      </div>
    </div>
  );
}

function SectionCard({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
    >
      <span className="block text-base font-semibold">{title}</span>
      <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{detail}</span>
    </button>
  );
}
