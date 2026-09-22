import Dexie, { type Table } from 'dexie';
import type { Match, Player, PlayerPhoto } from '../types';

/**
 * Current schema version. Bump this and add a Dexie `.version(n)` block
 * with an `.upgrade()` migration whenever the shape of stored records
 * changes.
 *
 * Small app-level settings (theme, alert sound, etc.) intentionally live in
 * `localStorage` instead of IndexedDB — see `src/state/localSettings.ts`.
 */
export const DB_VERSION = 1;

class TeamTrackDatabase extends Dexie {
  players!: Table<Player, string>;
  photos!: Table<PlayerPhoto, string>;
  matches!: Table<Match, string>;

  constructor() {
    super('teamtrack');

    this.version(DB_VERSION).stores({
      players: 'id, name, jerseyNumber, availability',
      photos: 'id, playerId',
      matches: 'id, date, updatedAt',
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
