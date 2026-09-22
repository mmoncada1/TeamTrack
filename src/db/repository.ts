import { db } from './db';
import type { Match, Player, PlayerPhoto, Team } from '../types';
import { isValidPlayerRecord } from '../lib/validation';
import { comparePlayersByJersey } from '../lib/playerSort';
import { createId } from '../lib/id';

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function listTeams(): Promise<Team[]> {
  const teams = await db.teams.toArray();
  return teams.sort((a, b) => a.name.localeCompare(b.name));
}

export async function upsertTeam(team: Team): Promise<void> {
  await db.teams.put(team);
}

export async function createTeam(name: string): Promise<Team> {
  const now = Date.now();
  const team: Team = { id: createId(), name: name.trim(), createdAt: now, updatedAt: now };
  await db.teams.add(team);
  return team;
}

/** Ensure at least one team exists. Returns every team. */
export async function ensureTeams(): Promise<Team[]> {
  const existing = await listTeams();
  if (existing.length > 0) return existing;
  const team = await createTeam('My Team');
  return [team];
}

export async function deleteTeamAndData(teamId: string): Promise<void> {
  await db.transaction('rw', db.teams, db.players, db.photos, db.matches, async () => {
    const players = await db.players.where('teamId').equals(teamId).toArray();
    for (const player of players) {
      const photos = await db.photos.where('playerId').equals(player.id).toArray();
      await Promise.all(photos.map((photo) => db.photos.delete(photo.id)));
      await db.players.delete(player.id);
    }
    const matches = await db.matches.where('teamId').equals(teamId).toArray();
    await Promise.all(matches.map((match) => db.matches.delete(match.id)));
    await db.teams.delete(teamId);
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
  return valid.sort(comparePlayersByJersey);
}

export async function upsertPlayer(player: Player): Promise<void> {
  await db.players.put(player);
}

export async function deletePlayer(playerId: string): Promise<void> {
  await db.transaction('rw', db.players, db.photos, async () => {
    await db.players.delete(playerId);
    const photos = await db.photos.where('playerId').equals(playerId).toArray();
    await Promise.all(photos.map((p) => db.photos.delete(p.id)));
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

export async function replaceAllData(teams: Team[], players: Player[], matches: Match[]): Promise<void> {
  await db.transaction('rw', db.teams, db.players, db.photos, db.matches, async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    // Imported backups do not include photo blobs (JSON can't hold them
    // efficiently) — existing photos are left untouched so profile
    // pictures for surviving players aren't lost after an import.
    await db.teams.bulkPut(teams);
    await db.players.bulkPut(players);
    await db.matches.bulkPut(matches);
  });
}
