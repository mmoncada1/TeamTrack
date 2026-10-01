import { db } from '../db/db';
import { teamSport } from '../lib/sports';
import type { FootballFormation, FootballPlay, DrivePlan, FootballData } from './types';
import { formationErrors, playErrors, isDrive } from './validation';

async function assertFootballTeam(teamId: string) {
  const team = await db.teams.get(teamId);
  if (!team || teamSport(team) !== 'football') throw new Error('Choose a football team.');
}
async function assertRoster(formation: FootballFormation) {
  for (const slot of formation.players) {
    if (!slot.rosterPlayerId) continue;
    const player = await db.players.get(slot.rosterPlayerId);
    if (!player || player.teamId !== formation.teamId)
      throw new Error('Assigned roster player is no longer on this team.');
  }
}
export async function saveFormation(formation: FootballFormation) {
  const errors = formationErrors(formation);
  if (errors.length) throw new Error(errors.join(' '));
  await db.transaction('rw', [db.teams, db.players, db.footballFormations], async () => {
    await assertFootballTeam(formation.teamId);
    await assertRoster(formation);
    await db.footballFormations.put({ ...formation, updatedAt: Date.now() });
  });
}
export async function savePlay(play: FootballPlay) {
  const errors = playErrors(play);
  if (errors.length) throw new Error(errors.join(' '));
  await db.transaction('rw', [db.teams, db.players, db.footballPlays], async () => {
    await assertFootballTeam(play.teamId);
    await assertRoster(play);
    await db.footballPlays.put({ ...play, updatedAt: Date.now() });
  });
}
export async function saveDrive(drive: DrivePlan) {
  if (!isDrive(drive)) throw new Error('Drive name and entries must be valid.');
  await db.transaction('rw', [db.teams, db.footballPlays, db.drivePlans], async () => {
    await assertFootballTeam(drive.teamId);
    for (const entry of drive.entries) {
      const play = await db.footballPlays.get(entry.playId);
      if (!play || play.teamId !== drive.teamId)
        throw new Error('Drive plays must belong to this team.');
    }
    await db.drivePlans.put({ ...drive, updatedAt: Date.now() });
  });
}
export async function deletePlay(id: string) {
  await db.transaction('rw', [db.footballPlays, db.drivePlans], async () => {
    await db.footballPlays.delete(id);
    await db.drivePlans.toCollection().modify((drive) => {
      drive.entries = drive.entries.filter((e) => e.playId !== id);
    });
  });
}
export async function footballBackup(): Promise<FootballData> {
  const [footballFormations, footballPlays, drivePlans, footballWhiteboards] = await Promise.all([
    db.footballFormations.toArray(),
    db.footballPlays.toArray(),
    db.drivePlans.toArray(),
    db.footballWhiteboards.toArray(),
  ]);
  return { footballFormations, footballPlays, drivePlans, footballWhiteboards };
}
