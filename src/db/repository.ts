import { db } from './db';
import type { Match, Player, PlayerPhoto } from '../types';
import { isValidPlayerRecord } from '../lib/validation';
import { comparePlayersByJersey } from '../lib/playerSort';

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

export async function replaceAllData(players: Player[], matches: Match[]): Promise<void> {
  await db.transaction('rw', db.players, db.photos, db.matches, async () => {
    await db.players.clear();
    await db.matches.clear();
    // Imported backups do not include photo blobs (JSON can't hold them
    // efficiently) — existing photos are left untouched so profile
    // pictures for surviving players aren't lost after an import.
    await db.players.bulkPut(players);
    await db.matches.bulkPut(matches);
  });
}
