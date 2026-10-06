import { db } from './db';
import type { Match, Player, PlayerPhoto, SavedLineup, Team, TeamPhoto } from '../types';
import { isValidPlayerRecord } from '../lib/validation';
import { comparePlayersByJersey } from '../lib/playerSort';
import { createId } from '../lib/id';
import { clampMinGirls } from '../lib/coed';
import { withPositionGroups } from '../lib/playerPositions';
import { teamSport, type Sport } from '../lib/sports';
import type { FootballData } from '../football/types';

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function listTeams(): Promise<Team[]> {
  const teams = await db.teams.toArray();
  return teams.map(team => ({ ...team, sport: teamSport(team) })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function upsertTeam(team: Team): Promise<void> {
  const existing = await db.teams.get(team.id);
  if (existing && teamSport(existing) !== teamSport(team)) throw new Error('A team’s sport cannot be changed after creation.');
  await db.teams.put({ ...team, sport: teamSport(team) });
}

export async function createTeam(
  name: string,
  options?: { coed?: boolean; minGirlsOnField?: number; sport?: Sport },
): Promise<Team> {
  const now = Date.now();
  const coed = Boolean(options?.coed);
  const team: Team = {
    id: createId(),
    name: name.trim(),
    sport: options?.sport ?? 'soccer',
    createdAt: now,
    updatedAt: now,
    ...(coed ? { coed: true, minGirlsOnField: clampMinGirls(options?.minGirlsOnField) } : {}),
  };
  await db.teams.add(team);
  return team;
}

/** Ensure at least one team exists. Returns every team. */
export async function ensureTeams(): Promise<Team[]> {
  // React StrictMode may request initialization twice. Serialize the empty check
  // and insert so concurrent startup calls cannot create duplicate default teams.
  return db.transaction('rw', db.teams, async () => {
    const existing = await listTeams();
    if (existing.length > 0) return existing;
    const team = await createTeam('My Team');
    return [team];
  });
}

export async function deleteTeamAndData(teamId: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const players = await db.players.where('teamId').equals(teamId).toArray();
    for (const player of players) {
      const photos = await db.photos.where('playerId').equals(player.id).toArray();
      await Promise.all(photos.map((photo) => db.photos.delete(photo.id)));
      await db.players.delete(player.id);
    }
    const teamPhotos = await db.teamPhotos.where('teamId').equals(teamId).toArray();
    await Promise.all(teamPhotos.map((photo) => db.teamPhotos.delete(photo.id)));
    const lineups = await db.lineups.where('teamId').equals(teamId).toArray();
    await Promise.all(lineups.map((lineup) => db.lineups.delete(lineup.id)));
    const matches = await db.matches.where('teamId').equals(teamId).toArray();
    await Promise.all(matches.map((match) => db.matches.delete(match.id)));
    await db.teams.delete(teamId);
    for (const table of [db.footballFormations, db.footballPlays, db.drivePlans, db.footballWhiteboards]) {
      await table.where('teamId').equals(teamId).delete();
    }
  });
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export async function listPlayers(): Promise<Player[]> {
  const raw = await db.players.toArray();
  const valid = raw.filter(isValidPlayerRecord);
  if (valid.length !== raw.length) {
    console.warn(`Dropped ${raw.length - valid.length} corrupt player record(s) while loading.`);
  }
  return valid.map(withPositionGroups).sort(comparePlayersByJersey);
}

export async function upsertPlayer(player: Player): Promise<void> {
  await db.players.put(player);
}

export async function deletePlayer(playerId: string): Promise<void> {
  await db.transaction('rw', [db.players, db.photos, db.footballFormations, db.footballPlays], async () => {
    await db.players.delete(playerId);
    const photos = await db.photos.where('playerId').equals(playerId).toArray();
    await Promise.all(photos.map((p) => db.photos.delete(p.id)));
    for (const table of [db.footballFormations, db.footballPlays]) {
      await table.toCollection().modify(formation => {
        formation.players = formation.players.map(slot => slot.rosterPlayerId === playerId ? { ...slot, rosterPlayerId: undefined } : slot);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function upsertPhoto(photo: PlayerPhoto): Promise<void> {
  await db.transaction('rw', db.photos, async () => {
    const existing = await db.photos.where('playerId').equals(photo.playerId).toArray();
    await Promise.all(existing.filter((p) => p.id !== photo.id).map((p) => db.photos.delete(p.id)));
    await db.photos.put(photo);
  });
}

export async function getPhotoForPlayer(playerId: string): Promise<PlayerPhoto | undefined> {
  return db.photos.where('playerId').equals(playerId).first();
}

export async function deletePhotoForPlayer(playerId: string): Promise<void> {
  const photos = await db.photos.where('playerId').equals(playerId).toArray();
  await Promise.all(photos.map((p) => db.photos.delete(p.id)));
}

export async function listPhotos(): Promise<PlayerPhoto[]> {
  return db.photos.toArray();
}

export async function upsertTeamPhoto(photo: TeamPhoto): Promise<void> {
  await db.transaction('rw', db.teamPhotos, async () => {
    const existing = await db.teamPhotos.where('teamId').equals(photo.teamId).toArray();
    await Promise.all(existing.filter((p) => p.id !== photo.id).map((p) => db.teamPhotos.delete(p.id)));
    await db.teamPhotos.put(photo);
  });
}

export async function deleteTeamPhoto(teamId: string): Promise<void> {
  const photos = await db.teamPhotos.where('teamId').equals(teamId).toArray();
  await Promise.all(photos.map((photo) => db.teamPhotos.delete(photo.id)));
}

export async function listTeamPhotos(): Promise<TeamPhoto[]> {
  return db.teamPhotos.toArray();
}

// ---------------------------------------------------------------------------
// Saved lineups
// ---------------------------------------------------------------------------

export async function listLineups(): Promise<SavedLineup[]> {
  const lineups = await db.lineups.toArray();
  return lineups.sort((a, b) => a.name.localeCompare(b.name));
}

export async function upsertLineup(lineup: SavedLineup): Promise<void> {
  await db.lineups.put(lineup);
}

export async function deleteLineup(lineupId: string): Promise<void> {
  await db.lineups.delete(lineupId);
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export async function listMatches(): Promise<Match[]> {
  const raw = await db.matches.toArray();
  return raw.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getMatch(matchId: string): Promise<Match | undefined> {
  return db.matches.get(matchId);
}

export async function upsertMatch(match: Match): Promise<void> {
  await db.matches.put(match);
}

export async function deleteMatch(matchId: string): Promise<void> {
  await db.matches.delete(matchId);
}

export async function replaceAllData(
  teams: Team[],
  players: Player[],
  matches: Match[],
  photos: PlayerPhoto[] = [],
  teamPhotos: TeamPhoto[] = [],
  lineups: SavedLineup[] = [],
  football: Partial<FootballData> = {},
): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.photos.clear();
    await db.teamPhotos.clear();
    await db.lineups.clear();
    await db.teams.bulkPut(teams);
    await db.players.bulkPut(players);
    await db.matches.bulkPut(matches);
    if (photos.length > 0) await db.photos.bulkPut(photos);
    if (teamPhotos.length > 0) await db.teamPhotos.bulkPut(teamPhotos);
    if (lineups.length > 0) await db.lineups.bulkPut(lineups);
    await db.footballFormations.clear();
    await db.footballPlays.clear();
    await db.drivePlans.clear();
    await db.footballWhiteboards.clear();
    await db.footballFormations.bulkPut(football.footballFormations ?? []);
    await db.footballPlays.bulkPut(football.footballPlays ?? []);
    await db.drivePlans.bulkPut(football.drivePlans ?? []);
    await db.footballWhiteboards.bulkPut(football.footballWhiteboards ?? []);
  });
}
