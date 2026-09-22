import { create } from 'zustand';
import type { Team } from '../types';
import * as repo from '../db/repository';

const ACTIVE_TEAM_KEY = 'teamtrack:active-team-id';

function readActiveTeamId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TEAM_KEY);
  } catch {
    return null;
  }
}

function writeActiveTeamId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_TEAM_KEY, id);
  } catch {
    // Ignore storage failures; the in-memory selection still works this session.
  }
}

interface TeamState {
  teams: Team[];
  activeTeamId: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  setActiveTeam: (id: string) => void;
  createTeam: (name: string) => Promise<{ error?: string; teamId?: string }>;
  renameTeam: (id: string, name: string) => Promise<{ error?: string }>;
  deleteTeam: (id: string) => Promise<{ error?: string }>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  activeTeamId: null,
  loaded: false,

  load: async () => {
    const teams = await repo.ensureTeams();
    const saved = readActiveTeamId();
    const activeTeamId = teams.some((team) => team.id === saved) ? saved : teams[0].id;
    if (activeTeamId) writeActiveTeamId(activeTeamId);
    set({ teams, activeTeamId, loaded: true });
  },

  setActiveTeam: (id) => {
    if (!get().teams.some((team) => team.id === id)) return;
    writeActiveTeamId(id);
    set({ activeTeamId: id });
  },

  createTeam: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: 'Team name is required.' };
    if (get().teams.some((team) => team.name.toLowerCase() === trimmed.toLowerCase())) {
      return { error: 'A team with that name already exists.' };
    }
    const team = await repo.createTeam(trimmed);
    const teams = [...get().teams, team].sort((a, b) => a.name.localeCompare(b.name));
    writeActiveTeamId(team.id);
    set({ teams, activeTeamId: team.id });
    return { teamId: team.id };
  },

  renameTeam: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: 'Team name is required.' };
    const existing = get().teams.find((team) => team.id === id);
    if (!existing) return { error: 'Team not found.' };
    if (get().teams.some((team) => team.id !== id && team.name.toLowerCase() === trimmed.toLowerCase())) {
      return { error: 'A team with that name already exists.' };
    }
    const updated: Team = { ...existing, name: trimmed, updatedAt: Date.now() };
    await repo.upsertTeam(updated);
    set({ teams: get().teams.map((team) => (team.id === id ? updated : team)) });
    return {};
  },

  deleteTeam: async (id) => {
    if (get().teams.length <= 1) return { error: 'Keep at least one team.' };
    await repo.deleteTeamAndData(id);
    const teams = get().teams.filter((team) => team.id !== id);
    const activeTeamId = get().activeTeamId === id ? teams[0].id : get().activeTeamId;
    if (activeTeamId) writeActiveTeamId(activeTeamId);
    set({ teams, activeTeamId });
    return {};
  },
}));

export function activeTeam(state: Pick<TeamState, 'teams' | 'activeTeamId'>): Team | null {
  return state.teams.find((team) => team.id === state.activeTeamId) ?? null;
}
