import Dexie, { type Table } from 'dexie';
import type { Match, Player, PlayerPhoto, Team, TeamPhoto } from '../types';
import { createId } from '../lib/id';

/**
 * Current schema version. Bump this and add a Dexie `.version(n)` block
 * with an `.upgrade()` migration whenever the shape of stored records
 * changes.
 *
 * Small app-level settings (theme, alert sound, etc.) intentionally live in
 * `localStorage` instead of IndexedDB — see `src/state/localSettings.ts`.
 */
export const DB_VERSION = 3;

class TeamTrackDatabase extends Dexie {
  teams!: Table<Team, string>;
  players!: Table<Player, string>;
  photos!: Table<PlayerPhoto, string>;
  teamPhotos!: Table<TeamPhoto, string>;
  matches!: Table<Match, string>;

  constructor() {
    super('teamtrack');

    this.version(1).stores({
      players: 'id, name, jerseyNumber, availability',
      photos: 'id, playerId',
      matches: 'id, date, updatedAt',
    });

    this.version(2)
      .stores({
        teams: 'id, name',
        players: 'id, teamId, name, jerseyNumber, availability',
        photos: 'id, playerId',
        matches: 'id, teamId, date, updatedAt',
      })
      .upgrade(async (tx) => {
        const teamId = createId();
        const now = Date.now();
        await tx.table('teams').add({ id: teamId, name: 'My Team', createdAt: now, updatedAt: now });
        await tx.table('players').toCollection().modify({ teamId });
        await tx.table('matches').toCollection().modify({ teamId });
      });

    this.version(DB_VERSION).stores({
      teams: 'id, name',
      players: 'id, teamId, name, jerseyNumber, availability',
      photos: 'id, playerId',
      teamPhotos: 'id, teamId',
      matches: 'id, teamId, date, updatedAt',
    });
  }
}

export const db = new TeamTrackDatabase();

/** Verify the database can open; surfaces corruption early at app start. */
export async function ensureDatabaseReady(): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.open();
    return { ok: true };
  } catch (err) {
    console.error('Failed to open TeamTrack database', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
