import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useTeamStore } from '../state/teamStore';

export function useFootballData() {
  const team = useTeamStore((s) => s.teams.find((t) => t.id === s.activeTeamId));
  const data = useLiveQuery(async () => {
    if (!team) return undefined;
    const [formations, plays, drives, players] = await Promise.all([
      db.footballFormations.where('teamId').equals(team.id).sortBy('name'),
      db.footballPlays.where('teamId').equals(team.id).sortBy('name'),
      db.drivePlans.where('teamId').equals(team.id).sortBy('name'),
      db.players.where('teamId').equals(team.id).sortBy('name'),
    ]);
    return { formations, plays, drives, players };
  }, [team?.id]);
  return { team, ...data, loaded: !!data };
}
