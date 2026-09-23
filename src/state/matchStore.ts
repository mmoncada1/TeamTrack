import { create } from 'zustand';
import type { Match, Player, SavedLineup, SlotId } from '../types';
import * as repo from '../db/repository';
import * as actions from '../lib/matchActions';
import { deriveMatchState } from '../lib/matchEngine';
import { useRosterStore } from './rosterStore';
import { useTeamStore } from './teamStore';
import { clampMinGirls, type CoedFieldRule } from '../lib/coed';
import type { RecordGoalInput, CreateDraftMatchInput, DraftMetaPatch } from '../lib/matchActions';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function coedRuleForTeam(teamId: string): CoedFieldRule | undefined {
  const team = useTeamStore.getState().teams.find((entry) => entry.id === teamId);
  if (!team?.coed) return undefined;
  return { minGirlsOnField: clampMinGirls(team.minGirlsOnField) };
}

function coedGuard(teamId: string): { rule?: CoedFieldRule; players: Player[] } | undefined {
  const rule = coedRuleForTeam(teamId);
  if (!rule) return undefined;
  return { rule, players: useRosterStore.getState().players };
}

interface MatchState {
  match: Match | null;
  allMatches: Match[];
  loading: boolean;
  saveStatus: SaveStatus;
  lastActionError: string | null;

  loadAllMatches: () => Promise<void>;
  loadMatch: (id: string) => Promise<void>;
  clearActiveMatch: () => void;
  createDraft: (input: CreateDraftMatchInput, players: Player[]) => Promise<string>;
  deleteMatchById: (id: string) => Promise<void>;

  updateDraftMeta: (patch: DraftMetaPatch) => void;
  updateLiveSettings: (patch: Partial<Match['settings']>) => void;
  setPendingFormation: (formationId: string, players: Player[]) => string;
  setPendingAssignment: (positionId: string, playerId: string | null) => void;
  movePendingPlayer: (playerId: string, toSlot: SlotId) => void;
  applySavedLineup: (lineup: SavedLineup) => void;
  autoFillPending: (players: Player[]) => string;

  start: () => void;
  pause: () => void;
  resume: () => void;
  goToHalfTime: () => void;
  endMatch: () => void;
  resetMatch: () => void;

  movePlayer: (playerId: string, toSlot: SlotId) => void;
  swapPlayers: (positionAId: string, positionBId: string) => void;
  substitutePlayer: (playerInId: string, positionId: string) => void;
  addPlayerToMatch: (playerId: string) => void;
  markPlayerInjured: (playerId: string) => void;
  returnPlayerToBench: (playerId: string) => void;
  removePlayerFromMatch: (playerId: string) => void;
  changeFormation: (formationId: string) => string;
  recordGoal: (input: RecordGoalInput) => void;
  recordCard: (playerId: string, color: 'yellow' | 'red') => void;
  deleteEvent: (eventId: string) => void;
  undoLastAction: () => void;
  dismissAlert: (alertId: string, action: 'dismiss' | 'snooze', snoozeMinutes?: number) => void;
  tick: (players: Player[]) => void;
}

function persist(match: Match): void {
  useMatchStore.setState({ saveStatus: 'saving' });
  repo
    .upsertMatch(match)
    .then(() => useMatchStore.setState({ saveStatus: 'saved' }))
    .catch((err) => {
      console.error('Failed to save match', err);
      useMatchStore.setState({ saveStatus: 'error' });
    });
}

function applyMutation(mutate: (match: Match) => Match): void {
  const current = useMatchStore.getState().match;
  if (!current) return;
  try {
    const next = mutate(current);
    if (next === current) return;
    useMatchStore.setState({ match: next, lastActionError: null });
    persist(next);
  } catch (err) {
    const message = err instanceof actions.MatchActionError ? err.message : 'Something went wrong.';
    useMatchStore.setState({ lastActionError: message });
    throw err;
  }
}

export const useMatchStore = create<MatchState>((set, get) => ({
  match: null,
  allMatches: [],
  loading: false,
  saveStatus: 'idle',
  lastActionError: null,

  loadAllMatches: async () => {
    const allMatches = await repo.listMatches();
    set({ allMatches });
  },

  loadMatch: async (id) => {
    set({ loading: true });
    const match = await repo.getMatch(id);
    set({ match: match ?? null, loading: false });
  },

  clearActiveMatch: () => set({ match: null }),

  createDraft: async (input, players) => {
    const draft = actions.createDraftMatch(input);
    const { match } = actions.setPendingFormation(draft, input.formationId, players, coedRuleForTeam(input.teamId));
    await repo.upsertMatch(match);
    set({ match, saveStatus: 'saved' });
    return match.id;
  },

  deleteMatchById: async (id) => {
    await repo.deleteMatch(id);
    set({ allMatches: get().allMatches.filter((m) => m.id !== id) });
    if (get().match?.id === id) set({ match: null });
  },

  updateDraftMeta: (patch) => {
    applyMutation((m) => actions.updateDraftMeta(m, patch));
  },

  updateLiveSettings: (patch) => {
    applyMutation((m) => actions.updateLiveSettings(m, patch));
  },

  setPendingFormation: (formationId, players) => {
    const current = get().match;
    if (!current) return '';
    const { match, summary } = actions.setPendingFormation(current, formationId, players, coedRuleForTeam(current.teamId));
    set({ match });
    persist(match);
    return summary;
  },

  setPendingAssignment: (positionId, playerId) => {
    applyMutation((m) => actions.setPendingAssignment(m, positionId, playerId));
  },

  movePendingPlayer: (playerId, toSlot) => {
    applyMutation((m) => actions.movePendingPlayer(m, playerId, toSlot, coedGuard(m.teamId)));
  },

  applySavedLineup: (lineup) => {
    const teamPlayerIds = useRosterStore
      .getState()
      .players.filter((player) => player.teamId === lineup.teamId)
      .map((player) => player.id);
    applyMutation((m) => actions.applySavedLineup(m, lineup, teamPlayerIds));
  },

  /** Re-run the automatic by-position fill for the current formation. */
  autoFillPending: (players) => {
    const current = get().match;
    if (!current) return '';
    const { match, summary } = actions.setPendingFormation(
      current,
      current.pendingFormationId,
      players,
      coedRuleForTeam(current.teamId),
    );
    set({ match });
    persist(match);
    return summary;
  },

  start: () => applyMutation((m) => actions.startMatch(m, Date.now(), coedGuard(m.teamId))),
  pause: () => applyMutation((m) => actions.pauseMatch(m)),
  resume: () => applyMutation((m) => actions.resumeMatch(m)),
  goToHalfTime: () => applyMutation((m) => actions.goToHalfTime(m)),
  endMatch: () => applyMutation((m) => actions.endMatch(m)),
  resetMatch: () => applyMutation((m) => actions.resetMatch(m)),

  movePlayer: (playerId, toSlot) =>
    applyMutation((m) =>
      actions.recomputeAlerts(
        actions.movePlayer(m, playerId, toSlot, Date.now(), coedGuard(m.teamId)),
        useRosterStore.getState().players,
        Date.now(),
        coedRuleForTeam(m.teamId),
      ),
    ),
  swapPlayers: (positionAId, positionBId) =>
    applyMutation((m) =>
      actions.recomputeAlerts(
        actions.swapPlayers(m, positionAId, positionBId),
        useRosterStore.getState().players,
        Date.now(),
        coedRuleForTeam(m.teamId),
      ),
    ),
  substitutePlayer: (playerInId, positionId) =>
    applyMutation((m) =>
      actions.recomputeAlerts(
        actions.substitutePlayer(m, playerInId, positionId, Date.now(), coedGuard(m.teamId)),
        useRosterStore.getState().players,
        Date.now(),
        coedRuleForTeam(m.teamId),
      ),
    ),
  addPlayerToMatch: (playerId) =>
    applyMutation((m) =>
      actions.recomputeAlerts(actions.addPlayerToMatch(m, playerId), useRosterStore.getState().players, Date.now(), coedRuleForTeam(m.teamId)),
    ),
  markPlayerInjured: (playerId) =>
    applyMutation((m) =>
      actions.recomputeAlerts(actions.markPlayerInjured(m, playerId), useRosterStore.getState().players, Date.now(), coedRuleForTeam(m.teamId)),
    ),
  returnPlayerToBench: (playerId) =>
    applyMutation((m) =>
      actions.recomputeAlerts(actions.returnPlayerToBench(m, playerId), useRosterStore.getState().players, Date.now(), coedRuleForTeam(m.teamId)),
    ),
  removePlayerFromMatch: (playerId) =>
    applyMutation((m) =>
      actions.recomputeAlerts(actions.removePlayerFromMatch(m, playerId), useRosterStore.getState().players, Date.now(), coedRuleForTeam(m.teamId)),
    ),

  changeFormation: (formationId) => {
    const current = get().match;
    if (!current) return '';
    const { match, summary } = actions.changeFormation(current, formationId, Date.now(), coedGuard(current.teamId));
    set({ match });
    persist(match);
    return summary;
  },

  recordGoal: (input) => applyMutation((m) => actions.recordGoal(m, input)),
  recordCard: (playerId, color) =>
    applyMutation((m) =>
      actions.recomputeAlerts(actions.recordCard(m, playerId, color), useRosterStore.getState().players, Date.now(), coedRuleForTeam(m.teamId)),
    ),
  deleteEvent: (eventId) => applyMutation((m) => actions.deleteEvent(m, eventId)),
  undoLastAction: () => applyMutation((m) => actions.undoLastAction(m)),
  dismissAlert: (alertId, action, snoozeMinutes) =>
    applyMutation((m) => actions.dismissAlert(m, alertId, action, snoozeMinutes)),

  tick: (players) => {
    const current = get().match;
    if (!current) return;
    const next = actions.recomputeAlerts(current, players, Date.now(), coedRuleForTeam(current.teamId));
    if (next !== current) {
      set({ match: next });
      persist(next);
    }
  },
}));

export function useDerivedMatch(nowMs: number) {
  const match = useMatchStore((s) => s.match);
  if (!match) return null;
  return deriveMatchState(match, nowMs);
}
