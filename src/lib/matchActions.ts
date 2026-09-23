import type {
  Alert,
  Assignment,
  Match,
  CardEvent,
  MatchEvent,
  PlayerRuntimeState,
  SlotId,
} from '../types';
import { createId } from './id';
import { deriveMatchState } from './matchEngine';
import { moveLeavesTooManyGuys, TOO_MANY_GUYS_MESSAGE, type CoedFieldRule } from './coed';
import { moveAssignment } from './lineupAssignments';
import { getFormationById } from '../formations/definitions';
import { remapFormation } from '../formations/remap';
import { fillFormationByPreference } from '../formations/fill';
import { updateAlerts } from './alerts';
import type { Player } from '../types';

const REVERSIBLE_EVENT_TYPES = new Set<MatchEvent['type']>([
  'PLAYER_MOVED',
  'PLAYERS_SWAPPED',
  'SUBSTITUTION',
  'PLAYER_JOINED',
  'PLAYER_UNAVAILABLE',
  'PLAYER_AVAILABLE',
  'PLAYER_REMOVED',
  'GOAL',
  'CARD',
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
  coed?: CoedFieldRule,
): { match: Match; summary: string } {
  const toFormation = getFormationById(newFormationId);
  if (!toFormation) throw new MatchActionError('Unknown formation.');

  const { assignments, summary } = fillFormationByPreference(
    toFormation,
    players,
    match.rosterPlayerIds,
    match.unavailablePlayerIds,
    coed,
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
 * Copy a saved lineup onto a draft match. Players in the lineup who were not
 * selected for this match are added to the match roster so the whole lineup
 * shows up, and anyone the manager marked unavailable is left out.
 */
export function applySavedLineup(
  match: Match,
  lineup: { format: Match['settings']['format']; formationId: string; assignments: Assignment },
  availablePlayerIds: string[],
  nowMs: number = Date.now(),
): Match {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status !== 'setup') {
    throw new MatchActionError('Cannot change the starting lineup after the match has started.');
  }
  const allowed = new Set(availablePlayerIds);
  const unavailable = new Set(match.unavailablePlayerIds);
  const assignments: Assignment = {};
  for (const [positionId, playerId] of Object.entries(lineup.assignments)) {
    if (allowed.has(playerId) && !unavailable.has(playerId)) assignments[positionId] = playerId;
  }
  const rosterPlayerIds = [...match.rosterPlayerIds];
  for (const playerId of Object.values(assignments)) {
    if (!rosterPlayerIds.includes(playerId)) rosterPlayerIds.push(playerId);
  }
  return {
    ...match,
    settings: { ...match.settings, format: lineup.format },
    rosterPlayerIds,
    pendingFormationId: lineup.formationId,
    pendingAssignments: assignments,
    updatedAt: nowMs,
  };
}

/**
 * Move a player during setup (bench <-> field, field <-> field, or a swap
 * if the destination is occupied). Never duplicates or drops a player.
 */
export function movePendingPlayer(
  match: Match,
  playerId: string,
  toSlot: SlotId,
  coed?: { rule?: CoedFieldRule; players: Player[] },
): Match {
  const assignments = moveAssignment(match.pendingAssignments, playerId, toSlot);
  if (assignments === match.pendingAssignments) return match;

  const next = { ...match, pendingAssignments: assignments };
  guardCoedLineup(coed?.rule, coed?.players, Object.values(match.pendingAssignments), Object.values(assignments));
  return next;
}

// ---------------------------------------------------------------------------
// Match lifecycle
// ---------------------------------------------------------------------------

export function startMatch(
  match: Match,
  nowMs: number = Date.now(),
  coed?: { rule?: CoedFieldRule; players: Player[] },
): Match {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status !== 'setup') {
    throw new MatchActionError('Match has already started.');
  }
  guardCoedLineup(coed?.rule, coed?.players, [], Object.values(match.pendingAssignments));
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

function assertMatchOpen(match: Match, nowMs: number) {
  const derived = deriveMatchState(match, nowMs);
  if (derived.status === 'setup' || derived.status === 'ended') {
    throw new MatchActionError('Players can only be added or removed while the match is underway.');
  }
  return derived;
}

/** Add a roster player to this match, on the bench, starting now. */
export function addPlayerToMatch(match: Match, playerId: string, nowMs: number = Date.now()): Match {
  const derived = assertMatchOpen(match, nowMs);
  if (derived.includedPlayerIds.includes(playerId)) {
    throw new MatchActionError('That player is already in this match.');
  }
  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, [playerId]),
    type: 'PLAYER_JOINED',
    playerId,
  };
  return withEvent(match, event);
}

/** Pull a player off the field or bench because they are injured. Time already played is kept. */
export function markPlayerInjured(match: Match, playerId: string, nowMs: number = Date.now()): Match {
  const derived = assertMatchOpen(match, nowMs);
  const state = derived.playerStates[playerId];
  if (!state || !derived.includedPlayerIds.includes(playerId)) {
    throw new MatchActionError('That player is not in this match.');
  }
  if (state.status === 'unavailable') throw new MatchActionError('That player is already out of the match.');
  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, [playerId]),
    type: 'PLAYER_UNAVAILABLE',
    playerId,
    reason: 'injured',
  };
  return withEvent(match, event);
}

/** Send an injured or previously unavailable player back to the bench. */
export function returnPlayerToBench(match: Match, playerId: string, nowMs: number = Date.now()): Match {
  const derived = assertMatchOpen(match, nowMs);
  const state = derived.playerStates[playerId];
  if (!state || !derived.includedPlayerIds.includes(playerId)) {
    throw new MatchActionError('That player is not in this match.');
  }
  if (state.status !== 'unavailable') throw new MatchActionError('That player is already available.');
  if (match.events.some((event) => event.type === 'CARD' && event.playerId === playerId && event.color === 'red')) {
    throw new MatchActionError('That player was sent off and cannot return.');
  }
  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, [playerId]),
    type: 'PLAYER_AVAILABLE',
    playerId,
  };
  return withEvent(match, event);
}

/** Take a player out of this match. Time already played is kept. */
export function removePlayerFromMatch(match: Match, playerId: string, nowMs: number = Date.now()): Match {
  const derived = assertMatchOpen(match, nowMs);
  if (!derived.includedPlayerIds.includes(playerId)) {
    throw new MatchActionError('That player is not in this match.');
  }
  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, [playerId]),
    type: 'PLAYER_REMOVED',
    playerId,
  };
  return withEvent(match, event);
}

function guardCoedLineup(
  rule: CoedFieldRule | undefined,
  players: Player[] | undefined,
  beforeFieldPlayerIds: Iterable<string>,
  afterFieldPlayerIds: Iterable<string>,
): void {
  if (!rule || !players) return;
  if (moveLeavesTooManyGuys(rule, players, beforeFieldPlayerIds, afterFieldPlayerIds)) {
    throw new MatchActionError(TOO_MANY_GUYS_MESSAGE);
  }
}

function assertSlotEmpty(assignments: Assignment, slot: SlotId, excludePlayerId?: string): void {
  if (slot === 'BENCH') return;
  const occupant = assignments[slot];
  if (occupant && occupant !== excludePlayerId) {
    throw new MatchActionError('That position is already occupied.');
  }
}

/** Move a single player between bench and an empty field position, or between two empty-destination slots. */
export function movePlayer(
  match: Match,
  playerId: string,
  toSlot: SlotId,
  nowMs: number = Date.now(),
  coed?: { rule?: CoedFieldRule; players: Player[] },
): Match {
  const derived = deriveMatchState(match, nowMs);
  const state = derived.playerStates[playerId];
  if (!state) throw new MatchActionError('Unknown player.');
  if (state.status === 'unavailable') throw new MatchActionError('Player is unavailable for this match.');

  const fromSlot: SlotId = state.positionId ?? 'BENCH';
  if (fromSlot === toSlot) return match;
  assertSlotEmpty(derived.assignments, toSlot, playerId);

  const fromField = fromSlot !== 'BENCH';
  const toField = toSlot !== 'BENCH';
  if (fromField !== toField) {
    const fieldIds = new Set(Object.values(derived.assignments));
    if (fromField) fieldIds.delete(playerId);
    if (toField) fieldIds.add(playerId);
    guardCoedLineup(coed?.rule, coed?.players, Object.values(derived.assignments), fieldIds);
  }

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
  coed?: { rule?: CoedFieldRule; players: Player[] },
): Match {
  const derived = deriveMatchState(match, nowMs);
  const playerOutId = derived.assignments[positionId];
  if (!playerOutId) throw new MatchActionError('That position is empty; use "move" instead of substitute.');
  if (playerOutId === playerInId) throw new MatchActionError('Cannot substitute a player for themself.');
  const inState = derived.playerStates[playerInId];
  if (!inState || inState.status !== 'bench') {
    throw new MatchActionError('The incoming player must be on the bench.');
  }
  const fieldIds = new Set(Object.values(derived.assignments));
  fieldIds.delete(playerOutId);
  fieldIds.add(playerInId);
  guardCoedLineup(coed?.rule, coed?.players, Object.values(derived.assignments), fieldIds);

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
  coed?: { rule?: CoedFieldRule; players: Player[] },
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
  guardCoedLineup(coed?.rule, coed?.players, Object.values(derived.assignments), Object.values(newAssignments));

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

export function recordCard(
  match: Match,
  playerId: string,
  color: 'yellow' | 'red',
  nowMs: number = Date.now(),
): Match {
  const derived = assertMatchOpen(match, nowMs);
  if (!derived.includedPlayerIds.includes(playerId)) {
    throw new MatchActionError('That player is not in this match.');
  }
  const prior = match.events.filter(
    (event): event is CardEvent => event.type === 'CARD' && event.playerId === playerId,
  );
  if (prior.some((event) => event.color === 'red')) {
    throw new MatchActionError('That player has already been sent off.');
  }
  const secondYellow = color === 'yellow' && prior.some((event) => event.color === 'yellow');
  const event: MatchEvent = {
    ...baseEvent(derived.matchClockMs, nowMs, [playerId]),
    type: 'CARD',
    playerId,
    color: secondYellow ? 'red' : color,
    secondYellow,
  };
  return withEvent(match, event);
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

export function recomputeAlerts(
  match: Match,
  players: Player[],
  nowMs: number = Date.now(),
  coed?: CoedFieldRule,
): Match {
  const derived = deriveMatchState(match, nowMs);
  // Also refresh during half-time and pause. The clock is frozen, but a
  // substitution still changes who is on the field, so outgoing alerts must
  // drop and the remaining recommendations must pick a different bench player.
  if (derived.status !== 'in_progress' && derived.status !== 'half_time' && derived.status !== 'paused') {
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
    coed,
  });
  if (alertsEqual(alerts, match.activeAlerts)) return match;
  return { ...match, activeAlerts: alerts };
}

function alertsEqual(a: Alert[], b: Alert[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (alert, i) =>
      alert.id === b[i].id &&
      alert.status === b[i].status &&
      alert.recommendation?.inPlayerId === b[i].recommendation?.inPlayerId,
  );
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

  const nextAlerts = match.activeAlerts.map((a) => {
    if (a.id !== alertId) return a;
    if (action === 'dismiss') return { ...a, status: 'dismissed' as const, recommendation: undefined };
    return {
      ...a,
      status: 'snoozed' as const,
      snoozeUntilClockMs: derived.matchClockMs + snoozeMinutes * 60000,
    };
  });

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
  teamId: string;
  teamName: string;
  opponentName: string;
  date: string;
  kickoffTime?: string;
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
    'teamName' | 'opponentName' | 'date' | 'kickoffTime' | 'title' | 'rosterPlayerIds' | 'unavailablePlayerIds'
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
    teamId: input.teamId,
    teamName: input.teamName,
    opponentName: input.opponentName,
    date: input.date,
    kickoffTime: input.kickoffTime,
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
