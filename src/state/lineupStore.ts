import { create } from 'zustand';
import type { Assignment, MatchFormat, SavedLineup } from '../types';
import * as repo from '../db/repository';
import { createId } from '../lib/id';

export interface LineupDraft {
  name: string;
  format: MatchFormat;
  formationId: string;
  assignments: Assignment;
}

interface LineupState {
  lineups: SavedLineup[];
  loaded: boolean;
  load: () => Promise<void>;
  createLineup: (teamId: string, draft: LineupDraft) => Promise<{ error?: string; lineupId?: string }>;
  updateLineup: (id: string, draft: LineupDraft) => Promise<{ error?: string }>;
  deleteLineup: (id: string) => Promise<void>;
}

function byName(a: SavedLineup, b: SavedLineup): number {
  return a.name.localeCompare(b.name);
}

export const useLineupStore = create<LineupState>((set, get) => ({
  lineups: [],
  loaded: false,

  load: async () => {
    const lineups = await repo.listLineups();
    set({ lineups, loaded: true });
  },

  createLineup: async (teamId, draft) => {
    const name = draft.name.trim();
    if (!name) return { error: 'Give the lineup a name.' };
    if (get().lineups.some((l) => l.teamId === teamId && l.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'This team already has a lineup with that name.' };
    }
    const now = Date.now();
    const lineup: SavedLineup = {
      id: createId(),
      teamId,
      name,
      format: draft.format,
      formationId: draft.formationId,
      assignments: draft.assignments,
      createdAt: now,
      updatedAt: now,
    };
    await repo.upsertLineup(lineup);
    set({ lineups: [...get().lineups, lineup].sort(byName) });
    return { lineupId: lineup.id };
  },

  updateLineup: async (id, draft) => {
    const existing = get().lineups.find((l) => l.id === id);
    if (!existing) return { error: 'Lineup not found.' };
    const name = draft.name.trim();
    if (!name) return { error: 'Give the lineup a name.' };
    if (
      get().lineups.some(
        (l) => l.id !== id && l.teamId === existing.teamId && l.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      return { error: 'This team already has a lineup with that name.' };
    }
    const updated: SavedLineup = {
      ...existing,
      name,
      format: draft.format,
      formationId: draft.formationId,
      assignments: draft.assignments,
      updatedAt: Date.now(),
    };
    await repo.upsertLineup(updated);
    set({ lineups: get().lineups.map((l) => (l.id === id ? updated : l)).sort(byName) });
    return {};
  },

  deleteLineup: async (id) => {
    await repo.deleteLineup(id);
    set({ lineups: get().lineups.filter((l) => l.id !== id) });
  },
}));
