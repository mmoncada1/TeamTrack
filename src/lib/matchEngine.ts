import type {
  Assignment,
  DerivedMatchState,
  Match,
  MatchEvent,
  MatchStatus,
  PlayerRuntimeState,
  PositionGroup,
  StatusInterval,
} from '../types';
import { getFormationById } from '../formations/definitions';
import { getMatchClockMs as computeClockFromClockLike, isClockRunning } from './timer';

function getPositionGroup(formationId: string, positionId: string | null): PositionGroup | null {
  if (!positionId) return null;
  const formation = getFormationById(formationId);
  const position = formation?.positions.find((p) => p.id === positionId);
  return position?.group ?? null;
}

function freshState(playerId: string): PlayerRuntimeState {
  return {
    playerId,
    status: 'bench',
    positionId: null,
    positionGroup: null,
    intervals: [],
    currentStintStartMs: null,
    currentStintMs: 0,
    totalFieldMs: 0,
    totalBenchMs: 0,
    subsIn: 0,
    subsOut: 0,
    lastSubTimeMs: null,
    goals: 0,
    assists: 0,
  };
}

function closeInterval(state: PlayerRuntimeState, atMs: number): void {
  if (state.currentStintStartMs == null) return;
  const open = state.intervals.find((i) => i.endMs === null);
  if (open) {
    open.endMs = atMs;
  }
  state.currentStintStartMs = null;
}

function openInterval(
  state: PlayerRuntimeState,
  status: 'field' | 'bench',
  positionId: string | undefined,
  atMs: number,
): void {
  const interval: StatusInterval = { status, positionId, startMs: atMs, endMs: null };
  state.intervals.push(interval);
  state.status = status;
  state.positionId = positionId ?? null;
  state.currentStintStartMs = atMs;
}

function transition(
  state: PlayerRuntimeState,
  status: 'field' | 'bench',
  positionId: string | undefined,
  atMs: number,
): void {
  if (state.status === status && state.positionId === (positionId ?? null)) {
    return; // no-op, nothing changed
  }
  closeInterval(state, atMs);
  openInterval(state, status, positionId, atMs);
}

/**
 * Place a player on the field or bench.
 * Moving between two field positions keeps the current on-field stint
 * (and its timer) running. Only a real status change — onto the field from
 * the bench, or off the field — starts a new stint.
 */
function placePlayer(
  state: PlayerRuntimeState,
  status: 'field' | 'bench',
  positionId: string | undefined,
  atMs: number,
): void {
  if (state.status === 'field' && status === 'field' && state.currentStintStartMs != null && positionId) {
    state.positionId = positionId;
    const open = state.intervals.find((interval) => interval.endMs === null);
    if (open) open.positionId = positionId;
    return;
  }
  transition(state, status, positionId, atMs);
}

/**
 * Replay a match's event log to derive the current authoritative state:
 * assignments, per-player status/intervals/totals, and score. This function
 * is pure and deterministic, so undo (removing the last event) or deleting
 * an arbitrary event and re-running this function always yields a correct,
 * consistent result.
 */
export function deriveMatchState(match: Match, nowMs: number = Date.now()): DerivedMatchState {
  const playerStates: Record<string, PlayerRuntimeState> = {};
  for (const playerId of match.rosterPlayerIds) {
    playerStates[playerId] = freshState(playerId);
    if (match.unavailablePlayerIds.includes(playerId)) {
      playerStates[playerId].status = 'unavailable';
    }
  }

  let assignments: Assignment = {};
  let formationId = match.settings.formationId;
  let teamScore = 0;
  let opponentScore = 0;
  let started = false;
  let ended = false;
  let status: MatchStatus = 'setup';
  let currentHalf: 1 | 2 = 1;
  /** Real timestamp + match-clock-ms pair captured whenever the clock (re)starts. */
  let runningAnchor: { realTimestamp: number; matchClockMsAtAnchor: number } | null = null;
  let frozenClockMs = 0;
  /** Cumulative match time when the first half ended. Display clock subtracts this in the second half. */
  let firstHalfEndMs: number | null = null;

  const events: MatchEvent[] = match.events;
  const removed = new Set<string>();
  const joined = new Set<string>();
  const injured = new Set<string>();
  const sentOff = new Set<string>();

  function leaveMatch(playerId: string, atMs: number): void {
    const state = playerStates[playerId];
    if (!state) return;
    if (state.positionId && assignments[state.positionId] === playerId) {
      delete assignments[state.positionId];
    }
    if (state.status !== 'unavailable') closeInterval(state, atMs);
    state.status = 'unavailable';
    state.positionId = null;
  }

  for (const ev of events) {
    switch (ev.type) {
      case 'MATCH_STARTED': {
        started = true;
        status = 'in_progress';
        runningAnchor = { realTimestamp: ev.timestamp, matchClockMsAtAnchor: ev.matchClockMs };
        formationId = ev.formationId;
        assignments = { ...ev.assignments };
        const positionByPlayer = new Map(Object.entries(assignments).map(([pos, pid]) => [pid, pos]));
        for (const playerId of match.rosterPlayerIds) {
          const state = playerStates[playerId];
          if (state.status === 'unavailable') continue;
          const positionId = positionByPlayer.get(playerId);
          openInterval(state, positionId ? 'field' : 'bench', positionId, ev.matchClockMs);
        }
        break;
      }
      case 'MATCH_PAUSED': {
        status = 'paused';
        frozenClockMs = ev.matchClockMs;
        runningAnchor = null;
        break;
      }
      case 'MATCH_RESUMED': {
        status = 'in_progress';
        runningAnchor = { realTimestamp: ev.timestamp, matchClockMsAtAnchor: ev.matchClockMs };
        break;
      }
      case 'HALF_TIME': {
        status = 'half_time';
        frozenClockMs = ev.matchClockMs;
        firstHalfEndMs = ev.matchClockMs;
        runningAnchor = null;
        break;
      }
      case 'SECOND_HALF_STARTED': {
        status = 'in_progress';
        currentHalf = 2;
        runningAnchor = { realTimestamp: ev.timestamp, matchClockMsAtAnchor: ev.matchClockMs };
        break;
      }
      case 'FORMATION_CHANGED': {
        formationId = ev.toFormationId;
        assignments = { ...ev.newAssignments };
        const positionByPlayer = new Map(Object.entries(assignments).map(([pos, pid]) => [pid, pos]));
        for (const playerId of match.rosterPlayerIds) {
          const state = playerStates[playerId];
          if (!state || state.status === 'unavailable' || removed.has(playerId)) continue;
          const positionId = positionByPlayer.get(playerId);
          placePlayer(state, positionId ? 'field' : 'bench', positionId, ev.matchClockMs);
        }
        for (const playerId of joined) {
          const state = playerStates[playerId];
          if (!state || state.status === 'unavailable' || removed.has(playerId)) continue;
          const positionId = positionByPlayer.get(playerId);
          placePlayer(state, positionId ? 'field' : 'bench', positionId, ev.matchClockMs);
        }
        break;
      }
      case 'PLAYER_JOINED': {
        if (removed.has(ev.playerId)) removed.delete(ev.playerId);
        joined.add(ev.playerId);
        injured.delete(ev.playerId);
        if (!playerStates[ev.playerId]) playerStates[ev.playerId] = freshState(ev.playerId);
        const state = playerStates[ev.playerId];
        if (state.status === 'unavailable' || state.currentStintStartMs == null) {
          openInterval(state, 'bench', undefined, ev.matchClockMs);
        }
        break;
      }
      case 'PLAYER_UNAVAILABLE': {
        if (!playerStates[ev.playerId] || removed.has(ev.playerId)) break;
        leaveMatch(ev.playerId, ev.matchClockMs);
        injured.add(ev.playerId);
        break;
      }
      case 'PLAYER_AVAILABLE': {
        const state = playerStates[ev.playerId];
        if (!state || removed.has(ev.playerId) || sentOff.has(ev.playerId) || state.status !== 'unavailable') break;
        injured.delete(ev.playerId);
        openInterval(state, 'bench', undefined, ev.matchClockMs);
        break;
      }
      case 'PLAYER_REMOVED': {
        if (!playerStates[ev.playerId]) break;
        leaveMatch(ev.playerId, ev.matchClockMs);
        injured.delete(ev.playerId);
        removed.add(ev.playerId);
        break;
      }
      case 'CARD': {
        if (ev.color !== 'red' || !playerStates[ev.playerId] || removed.has(ev.playerId)) break;
        leaveMatch(ev.playerId, ev.matchClockMs);
        injured.delete(ev.playerId);
        sentOff.add(ev.playerId);
        break;
      }
      case 'PLAYER_MOVED': {
        const state = playerStates[ev.playerId];
        if (!state) break;
        if (ev.fromSlot !== 'BENCH' && assignments[ev.fromSlot] === ev.playerId) {
          delete assignments[ev.fromSlot];
        }
        if (ev.toSlot !== 'BENCH') {
          assignments[ev.toSlot] = ev.playerId;
        }
        placePlayer(
          state,
          ev.toSlot === 'BENCH' ? 'bench' : 'field',
          ev.toSlot === 'BENCH' ? undefined : ev.toSlot,
          ev.matchClockMs,
        );
        break;
      }
      case 'PLAYERS_SWAPPED': {
        const stateA = playerStates[ev.playerAId];
        const stateB = playerStates[ev.playerBId];
        assignments[ev.positionAId] = ev.playerBId;
        assignments[ev.positionBId] = ev.playerAId;
        if (stateA) placePlayer(stateA, 'field', ev.positionBId, ev.matchClockMs);
        if (stateB) placePlayer(stateB, 'field', ev.positionAId, ev.matchClockMs);
        break;
      }
      case 'SUBSTITUTION': {
        const stateIn = playerStates[ev.playerInId];
        const stateOut = playerStates[ev.playerOutId];
        assignments[ev.positionId] = ev.playerInId;
        if (stateOut) {
          transition(stateOut, 'bench', undefined, ev.matchClockMs);
          stateOut.subsOut += 1;
          stateOut.lastSubTimeMs = ev.matchClockMs;
        }
        if (stateIn) {
          transition(stateIn, 'field', ev.positionId, ev.matchClockMs);
          stateIn.subsIn += 1;
          stateIn.lastSubTimeMs = ev.matchClockMs;
        }
        break;
      }
      case 'GOAL': {
        if (ev.isOwnGoal) {
          opponentScore += 1;
        } else if (ev.team === 'us') {
          teamScore += 1;
          if (ev.scorerId && playerStates[ev.scorerId]) {
            playerStates[ev.scorerId].goals += 1;
          }
          if (ev.assisterId && playerStates[ev.assisterId]) {
            playerStates[ev.assisterId].assists += 1;
          }
        } else {
          opponentScore += 1;
        }
        break;
      }
      case 'MATCH_ENDED': {
        ended = true;
        status = 'ended';
        frozenClockMs = ev.matchClockMs;
        runningAnchor = null;
        break;
      }
      default:
        break;
    }
  }

  const clockLike = {
    status,
    clockRunningSince: runningAnchor?.realTimestamp ?? null,
    clockOffsetMs: runningAnchor ? runningAnchor.matchClockMsAtAnchor : frozenClockMs,
  };
  const matchClockMs = computeClockFromClockLike(clockLike, nowMs);
  const closingClockMs = ended ? frozenClockMs : matchClockMs;
  const displayClockMs =
    status === 'half_time'
      ? 0
      : currentHalf === 2 && firstHalfEndMs != null
        ? Math.max(0, matchClockMs - firstHalfEndMs)
        : matchClockMs;

  const trackedIds = new Set<string>(match.rosterPlayerIds);
  for (const playerId of joined) trackedIds.add(playerId);

  for (const playerId of trackedIds) {
    const state = playerStates[playerId];
    if (!state) continue;
    if (!removed.has(playerId) && state.status !== 'unavailable') {
      if (!started) {
        // Setup phase: reflect pending assignments without timers running.
        const pendingPositionId = Object.entries(match.pendingAssignments).find(
          ([, pid]) => pid === playerId,
        )?.[0];
        state.status = pendingPositionId ? 'field' : 'bench';
        state.positionId = pendingPositionId ?? null;
      }
      state.positionGroup = getPositionGroup(formationId, state.positionId);
    }

    let totalField = 0;
    let totalBench = 0;
    for (const interval of state.intervals) {
      const end = interval.endMs ?? closingClockMs;
      const duration = Math.max(0, end - interval.startMs);
      if (interval.status === 'field') totalField += duration;
      else totalBench += duration;
    }
    state.totalFieldMs = totalField;
    state.totalBenchMs = totalBench;
    state.currentStintMs =
      state.currentStintStartMs != null ? Math.max(0, closingClockMs - state.currentStintStartMs) : 0;
  }

  const includedPlayerIds = [...trackedIds].filter((playerId) => !removed.has(playerId));

  return {
    status,
    currentHalf,
    assignments: started ? assignments : { ...match.pendingAssignments },
    formationId: started ? formationId : match.pendingFormationId,
    playerStates,
    includedPlayerIds,
    injuredPlayerIds: [...injured].filter((playerId) => includedPlayerIds.includes(playerId)),
    sentOffPlayerIds: [...sentOff].filter((playerId) => includedPlayerIds.includes(playerId)),
    teamScore,
    opponentScore,
    matchClockMs,
    displayClockMs,
    isClockRunning: isClockRunning(clockLike),
  };
}
