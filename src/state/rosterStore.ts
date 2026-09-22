import { create } from 'zustand';
import type { Player, PlayerAvailability, PositionGroup } from '../types';
import * as repo from '../db/repository';
import { createId } from '../lib/id';
import { compressImageFile } from '../lib/photo';
import { validatePlayerInput, type FieldError } from '../lib/validation';
import { comparePlayersByJersey } from '../lib/playerSort';

export interface PlayerFormInput {
  name: string;
  /** Empty string / undefined means "no jersey number assigned". */
  jerseyNumber: number | string | undefined;
  preferredGroup: PositionGroup;
  notes?: string;
  availability: PlayerAvailability;
  photoFile?: File | null;
  removePhoto?: boolean;
}

function parseJerseyNumber(raw: number | string | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const trimmed = String(raw).trim();
  if (trimmed === '') return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
}

interface RosterState {
  players: Player[];
  loaded: boolean;
  load: () => Promise<void>;
  addPlayer: (input: PlayerFormInput) => Promise<{ errors: FieldError[]; playerId?: string }>;
  updatePlayer: (id: string, input: PlayerFormInput) => Promise<{ errors: FieldError[] }>;
  deletePlayer: (id: string) => Promise<void>;
  setAvailability: (id: string, availability: PlayerAvailability) => Promise<void>;
}

export const useRosterStore = create<RosterState>((set, get) => ({
  players: [],
  loaded: false,

  load: async () => {
    const players = await repo.listPlayers();
    set({ players, loaded: true });
  },

  addPlayer: async (input) => {
    const errors = validatePlayerInput(input, get().players);
    if (errors.length > 0) return { errors };

    const now = Date.now();
    const id = createId();
    const player: Player = {
      id,
      name: input.name.trim(),
      jerseyNumber: parseJerseyNumber(input.jerseyNumber),
      preferredGroup: input.preferredGroup,
      notes: input.notes?.trim() || undefined,
      availability: input.availability,
      createdAt: now,
      updatedAt: now,
    };

    if (input.photoFile) {
      const photoId = createId();
      const compressed = await compressImageFile(input.photoFile);
      await repo.upsertPhoto({
        id: photoId,
        playerId: id,
        blob: compressed.blob,
        mimeType: compressed.mimeType,
        width: compressed.width,
        height: compressed.height,
        createdAt: now,
      });
      player.photoId = photoId;
    }

    await repo.upsertPlayer(player);
    set({ players: [...get().players, player].sort(comparePlayersByJersey) });
    return { errors: [], playerId: id };
  },

  updatePlayer: async (id, input) => {
    const existing = get().players.find((p) => p.id === id);
    if (!existing) return { errors: [{ field: 'name', message: 'Player not found.' }] };

    const errors = validatePlayerInput(input, get().players, id);
    if (errors.length > 0) return { errors };

    const now = Date.now();
    const updated: Player = {
      ...existing,
      name: input.name.trim(),
      jerseyNumber: parseJerseyNumber(input.jerseyNumber),
      preferredGroup: input.preferredGroup,
      notes: input.notes?.trim() || undefined,
      availability: input.availability,
      updatedAt: now,
    };

    if (input.removePhoto) {
      await repo.deletePhotoForPlayer(id);
      updated.photoId = undefined;
    } else if (input.photoFile) {
      const photoId = createId();
      const compressed = await compressImageFile(input.photoFile);
      await repo.upsertPhoto({
        id: photoId,
        playerId: id,
        blob: compressed.blob,
        mimeType: compressed.mimeType,
        width: compressed.width,
        height: compressed.height,
        createdAt: now,
      });
      updated.photoId = photoId;
    }

    await repo.upsertPlayer(updated);
    set({
      players: get()
        .players.map((p) => (p.id === id ? updated : p))
        .sort(comparePlayersByJersey),
    });
    return { errors: [] };
  },

  deletePlayer: async (id) => {
    await repo.deletePlayer(id);
    set({ players: get().players.filter((p) => p.id !== id) });
  },

  setAvailability: async (id, availability) => {
    const existing = get().players.find((p) => p.id === id);
    if (!existing) return;
    const updated = { ...existing, availability, updatedAt: Date.now() };
    await repo.upsertPlayer(updated);
    set({ players: get().players.map((p) => (p.id === id ? updated : p)) });
  },
}));
