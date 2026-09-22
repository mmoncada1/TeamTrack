import type {
  Alert,
  Assignment,
  Match,
  MatchEvent,
  PlayerRuntimeState,
  SlotId,
} from '../types';
import { createId } from './id';
import { deriveMatchState } from './matchEngine';
import { getFormationById } from '../formations/definitions';
import { remapFormation } from '../formations/remap';
import { fillFormationByPreference } from '../formations/fill';
import { updateAlerts } from './alerts';
import type { Player } from '../types';

const REVERSIBLE_EVENT_TYPES = new Set<MatchEvent['type']>([
  'PLAYER_MOVED',
  'PLAYERS_SWAPPED',
  'SUBSTITUTION',
  'GOAL',
  'FORMATION_CHANGED',
]);

function baseEvent(matchClockMs: number, nowMs: number, playerIds: string[] = []) {
  return {
    id: createId(),
    matchClockMs,
    timestamp: nowMs,
    playerIds,
  };
}

function withEvent(match: Match, event: MatchEvent): Match {
  return {
    ...match,
    events: [...match.events, event],
    updatedAt: event.timestamp,
  };
}

export class MatchActionError extends Error {}

// ---------------------------------------------------------------------------
// Setup-phase (pre-start) mutations — no events, just editing the draft.
// ---------------------------------------------------------------------------

export function setPendingFormation(
  match: Match,
  newFormationId: string,
  players: Player[],
): { match: Match; summary: string } {
  const toFormation = getFormationById(newFormationId);
  if (!toFormation) throw new MatchActionError('Unknown formation.');

  const { assignments, summary } = fillFormationByPreference(
    toFormation,
    players,
    match.rosterPlayerIds,
    match.unavailablePlayerIds,
  );
  return {
    match: { ...match, pendingFormationId: newFormationId, pendingAssignments: assignments },
    summary,
  };
}

export function setPendingAssignment(match: Match, positionId: string, playerId: string | null): Match {
  const next: Assignment = { ...match.pendingAssignments };
  if (playerId == null) {
    delete next[positionId];
  } else {
    // Ensure this player doesn't occupy two positions at once.
    for (const key of Object.keys(next)) {
      if (next[key] === playerId) delete next[key];
    }
    next[positionId] = playerId;
  }
  return { ...match, pendingAssignments: next };
}

export function clearPendingAssignment(match: Match, positionId: string): Match {
  return setPendingAssignment(match, positionId, null);
}

/**
 * Move a player during setup (bench <-> field, field <-> field, or a swap
 * if the destination is occupied). Never duplicates or drops a player.
 */
export function movePendingPlayer(match: Match, playerId: string, toSlot: SlotId): Match {
  const assignments = { ...match.pendingAssignments };
  const fromSlot = (Object.keys(assignments).find((k) => assignments[k] === playerId) ?? 'BENCH') as SlotId;
  if (fromSlot === toSlot) return match;

  const occupantOfTarget = toSlot !== 'BENCH' ? assignments[toSlot] : undefined;

  if (fromSlot !== 'BENCH') delete assignments[fromSlot];
  if (toSlot !== 'BENCH') {
    if (occupantOfTarget && occupantOfTarget !== playerId) {
      // Bump whoever was there to the player's old spot (swap), or to the bench if they came from the bench.
      if (fromSlot !== 'BENCH') {
        assignments[fromSlot] = occupantOfTarget;
      }
    }
    assignments[toSlot] = playerId;
  }

  return { ...match, pendingAssignments: assignments };
}

// ---------------------------------------------------------------------------
// Match lifecycle
// ---------------------------------------------------------------------------

export function startMatch(match: Match, nowMs: number = Date.now()): Match {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status !== 'setup') {
    throw new MatchActionError('Match has already started.');
  }
  const event: MatchEvent = {
    ...baseEvent(0, nowMs, Object.values(match.pendingAssignments)),
    type: 'MATCH_STARTED',
    formationId: match.pendingFormationId,
    assignments: { ...match.pendingAssignments },
    unavailablePlayerIds: [...match.unavailablePlayerIds],
  };
  return withEvent(match, event);
}

export function pauseMatch(match: Match, nowMs: number = Date.now()): Match {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status !== 'in_progress') throw new MatchActionError('Match is not running.');
  const event: MatchEvent = { ...baseEvent(derived.matchClockMs, nowMs), type: 'MATCH_PAUSED' };
  return withEvent(match, event);
}

export function resumeMatch(match: Match, nowMs: number = Date.now()): Match {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status !== 'paused' && derived.status !== 'half_time') {
    throw new MatchActionError('Match is not paused.');
  }
  const type = derived.status === 'half_time' ? 'SECOND_HALF_STARTED' : 'MATCH_RESUMED';
  const event: MatchEvent = { ...baseEvent(derived.matchClockMs, nowMs), type };
  return withEvent(match, event);
}

export function goToHalfTime(match: Match, nowMs: number = Date.now()): Match {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status !== 'in_progress') throw new MatchActionError('Match is not running.');
  const event: MatchEvent = { ...baseEvent(derived.matchClockMs, nowMs), type: 'HALF_TIME' };
  return withEvent(match, event);
}

export function endMatch(match: Match, nowMs: number = Date.now()): Match {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status === 'setup' || derived.status === 'ended') {
    throw new MatchActionError('Match cannot be ended from its current state.');
  }
  const event: MatchEvent = { ...baseEvent(derived.matchClockMs, nowMs), type: 'MATCH_ENDED' };
  return withEvent(match, event);
}

// ---------------------------------------------------------------------------
// Movement / substitutions (live match)
// ---------------------------------------------------------------------------

function assertSlotEmpty(assignments: Assignment, slot: SlotId, excludePlayerId?: string): void {
  if (slot === 'BENCH') return;
  const occupant = assignments[slot];
  if (occupant && occupant !== excludePlayerId) {
    throw new MatchActionError('That position is already occupied.');
  }
}

/** Move a single player between bench and an empty field position, or between two empty-destination slots. */
export function movePlayer(match: Match, playerId: string, toSlot: SlotId, nowMs: number = Date.now()): Match {
  const derived = deriveMatchState(match, nowMs);
  const state = derived.playerStates[playerId];
  if (!state) throw new MatchActionError('Unknown player.');
  if (state.status === 'unavailable') throw new MatchActionError('Player is unavailable for this match.');

  const fromSlot: SlotId = state.positionId ?? 'BENCH';
  if (fromSlot === toSlot) return match;
  assertSlotEmpty(derived.assignments, toSlot, playerId);

  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, [playerId]),
    type: 'PLAYER_MOVED',
    playerId,
    fromSlot,
    toSlot,
  };
  return withEvent(match, event);
}

/** Swap two players who are both currently on the field. */
export function swapPlayers(
  match: Match,
  positionAId: string,
  positionBId: string,
  nowMs: number = Date.now(),
): Match {
  const derived = deriveMatchState(match, nowMs);
  const playerAId = derived.assignments[positionAId];
  const playerBId = derived.assignments[positionBId];
  if (!playerAId || !playerBId) {
    throw new MatchActionError('Both positions must be occupied to swap players.');
  }
  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, [playerAId, playerBId]),
    type: 'PLAYERS_SWAPPED',
    playerAId,
    positionAId,
    playerBId,
    positionBId,
  };
  return withEvent(match, event);
}

/** Substitute a bench player into an occupied field position. */
export function substitutePlayer(
  match: Match,
  playerInId: string,
  positionId: string,
  nowMs: number = Date.now(),
): Match {
  const derived = deriveMatchState(match, nowMs);
  const playerOutId = derived.assignments[positionId];
  if (!playerOutId) throw new MatchActionError('That position is empty; use "move" instead of substitute.');
  if (playerOutId === playerInId) throw new MatchActionError('Cannot substitute a player for themself.');
  const inState = derived.playerStates[playerInId];
  if (!inState || inState.status !== 'bench') {
    throw new MatchActionError('The incoming player must be on the bench.');
  }

  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, [playerInId, playerOutId]),
    type: 'SUBSTITUTION',
    playerInId,
    playerOutId,
    positionId,
  };
  return withEvent(match, event);
}

// ---------------------------------------------------------------------------
// Formation changes (live match)
// ---------------------------------------------------------------------------

export function changeFormation(
  match: Match,
  newFormationId: string,
  nowMs: number = Date.now(),
): { match: Match; summary: string } {
  const derived = deriveMatchState(match, nowMs);
  const fromFormation = getFormationById(derived.formationId);
  const toFormation = getFormationById(newFormationId);
  if (!fromFormation || !toFormation) throw new MatchActionError('Unknown formation.');
  if (fromFormation.id === toFormation.id) return { match, summary: 'Formation unchanged.' };

  const { newAssignments, movedToBenchPlayerIds, summary } = remapFormation(
    fromFormation,
    toFormation,
    derived.assignments,
  );

  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, Object.values(newAssignments)),
    type: 'FORMATION_CHANGED',
    fromFormationId: fromFormation.id,
    toFormationId: toFormation.id,
    newAssignments,
    movedToBenchPlayerIds,
    summary,
  };
  return { match: withEvent(match, event), summary };
}

// ---------------------------------------------------------------------------
// Goals & assists
// ---------------------------------------------------------------------------

export interface RecordGoalInput {
  team: 'us' | 'opponent';
  isOwnGoal: boolean;
  scorerId?: string;
  assisterId?: string;
  note?: string;
}

export function recordGoal(match: Match, input: RecordGoalInput, nowMs: number = Date.now()): Match {
  if (input.scorerId && input.assisterId && input.scorerId === input.assisterId) {
    throw new MatchActionError('The scorer and assister cannot be the same player.');
  }
  const derived = deriveMatchState(match, nowMs);
  const playerIds = [input.scorerId, input.assisterId].filter((id): id is string => !!id);

  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, playerIds),
    type: 'GOAL',
    team: input.team,
    isOwnGoal: input.isOwnGoal,
    scorerId: input.scorerId,
    assisterId: input.assisterId,
    note: input.note,
  };
  return withEvent(match, event);
}

// ---------------------------------------------------------------------------
// Event log editing / undo
// ---------------------------------------------------------------------------

export function deleteEvent(match: Match, eventId: string): Match {
  return { ...match, events: match.events.filter((e) => e.id !== eventId), updatedAt: Date.now() };
}

/** Fully reset a match back to its pre-kickoff setup state (clears all events). Irreversible; caller must confirm. */
export function resetMatch(match: Match): Match {
  return { ...match, events: [], activeAlerts: [], updatedAt: Date.now() };
}

export function canUndo(match: Match): boolean {
  const last = match.events[match.events.length - 1];
  return !!last && REVERSIBLE_EVENT_TYPES.has(last.type);
}

export function undoLastAction(match: Match): Match {
  if (!canUndo(match)) throw new MatchActionError('Nothing to undo.');
  return { ...match, events: match.events.slice(0, -1), updatedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export function recomputeAlerts(match: Match, players: Player[], nowMs: number = Date.now()): Match {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status !== 'in_progress') {
    // No new alerts while paused/stopped, but keep existing ones as-is.
    return match;
  }
  const formation = getFormationById(derived.formationId);
  const { alerts } = updateAlerts({
    existingAlerts: match.activeAlerts,
    playerStates: derived.playerStates,
    players,
    thresholds: match.settings.thresholds,
    goalkeeperRotationEnabled: match.settings.goalkeeperRotationEnabled,
    positions: formation?.positions ?? [],
    rosterOrder: match.rosterPlayerIds,
    matchClockMs: derived.matchClockMs,
  });
  if (alertsEqual(alerts, match.activeAlerts)) return match;
  return { ...match, activeAlerts: alerts };
}

function alertsEqual(a: Alert[], b: Alert[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((alert, i) => alert.id === b[i].id && alert.status === b[i].status);
}

export function dismissAlert(
  match: Match,
  alertId: string,
  action: 'dismiss' | 'snooze',
  snoozeMinutes = 3,
  nowMs: number = Date.now(),
): Match {
  const derived = deriveMatchState(match, nowMs);
  const alert = match.activeAlerts.find((a) => a.id === alertId);
  if (!alert) throw new MatchActionError('Alert not found.');

  const nextAlerts = match.activeAlerts
    .map((a) => {
      if (a.id !== alertId) return a;
      if (action === 'dismiss') return { ...a, status: 'dismissed' as const };
      return {
        ...a,
        status: 'snoozed' as const,
        snoozeUntilClockMs: derived.matchClockMs + snoozeMinutes * 60000,
      };
    })
    .filter((a) => a.status !== 'dismissed');

  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, [alert.playerId]),
    type: 'ALERT_DISMISSED',
    alertId,
    playerId: alert.playerId,
    action,
  };

  return withEvent({ ...match, activeAlerts: nextAlerts }, event);
}

export function getPlayerState(match: Match, playerId: string, nowMs: number = Date.now()): PlayerRuntimeState | undefined {
  return deriveMatchState(match, nowMs).playerStates[playerId];
}

// ---------------------------------------------------------------------------
// Draft match creation (setup screen)
// ---------------------------------------------------------------------------

export interface CreateDraftMatchInput {
  teamName: string;
  opponentName: string;
  date: string;
  title?: string;
  format: Match['settings']['format'];
  formationId: string;
  halfLengthMinutes: number;
  numberOfHalves: 1 | 2;
  thresholds: Match['settings']['thresholds'];
  goalkeeperRotationEnabled: boolean;
  alertSoundEnabled: boolean;
  rosterPlayerIds: string[];
  unavailablePlayerIds: string[];
}

export type DraftMetaPatch = Partial<
  Pick<
    Match,
    'teamName' | 'opponentName' | 'date' | 'title' | 'rosterPlayerIds' | 'unavailablePlayerIds'
  >
> & { settings?: Partial<Match['settings']> };

/** Update match settings at any time, including substitution thresholds during a live match. */
export function updateLiveSettings(
  match: Match,
  patch: Partial<Match['settings']>,
  nowMs: number = Date.now(),
): Match {
  return {
    ...match,
    settings: { ...match.settings, ...patch },
    updatedAt: nowMs,
  };
}

/** Update setup-only fields on a draft match (before it has started). */
export function updateDraftMeta(match: Match, patch: DraftMetaPatch, nowMs: number = Date.now()): Match {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status !== 'setup') {
    throw new MatchActionError('Cannot edit setup details after the match has started.');
  }
  return {
    ...match,
    ...patch,
    settings: patch.settings ? { ...match.settings, ...patch.settings } : match.settings,
    updatedAt: nowMs,
  };
}

export function createDraftMatch(input: CreateDraftMatchInput, nowMs: number = Date.now()): Match {
  return {
    id: createId(),
    teamName: input.teamName,
    opponentName: input.opponentName,
    date: input.date,
    title: input.title,
    settings: {
      format: input.format,
      formationId: input.formationId,
      halfLengthMinutes: input.halfLengthMinutes,
      numberOfHalves: input.numberOfHalves,
      thresholds: input.thresholds,
      goalkeeperRotationEnabled: input.goalkeeperRotationEnabled,
      alertSoundEnabled: input.alertSoundEnabled,
    },
    rosterPlayerIds: input.rosterPlayerIds,
    unavailablePlayerIds: input.unavailablePlayerIds,
    pendingAssignments: {},
    pendingFormationId: input.formationId,
    events: [],
    activeAlerts: [],
    createdAt: nowMs,
    updatedAt: nowMs,
  };
}
