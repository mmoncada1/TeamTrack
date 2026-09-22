import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../types';
import type { PlayerRuntimeState } from '../types';
import { makePlayer } from './testHelpers';
import { findExceededOutgoingCandidates, recommendIncomingPlayer, recommendSubstitution } from './recommendations';
import { getFormationById } from '../formations/definitions';

function fieldState(playerId: string, positionId: string, positionGroup: PlayerRuntimeState['positionGroup'], currentStintMs: number): PlayerRuntimeState {
  return {
    playerId,
    status: 'field',
    positionId,
    positionGroup,
    intervals: [],
    currentStintStartMs: 0,
    currentStintMs,
    totalFieldMs: currentStintMs,
    totalBenchMs: 0,
    subsIn: 0,
    subsOut: 0,
    lastSubTimeMs: null,
    goals: 0,
    assists: 0,
  };
}

function benchState(playerId: string, currentStintMs: number, totalFieldMs = 0): PlayerRuntimeState {
  return {
    playerId,
    status: 'bench',
    positionId: null,
    positionGroup: null,
    intervals: [],
    currentStintStartMs: 0,
    currentStintMs,
    totalFieldMs,
    totalBenchMs: currentStintMs,
    subsIn: 0,
    subsOut: 0,
    lastSubTimeMs: null,
    goals: 0,
    assists: 0,
  };
}

const positions = getFormationById('7v7-2-3-1')!.positions;

describe('findExceededOutgoingCandidates', () => {
  it('ranks the player furthest beyond their threshold first', () => {
    const midPlayer = makePlayer({ name: 'Mid', jerseyNumber: 5, preferredGroup: 'MID' });
    const defPlayer = makePlayer({ name: 'Def', jerseyNumber: 2, preferredGroup: 'DEF' });

    const playerStates = {
      [midPlayer.id]: fieldState(midPlayer.id, 'mid-c', 'MID', 6 * 60_000), // threshold 4min -> 2min over
      [defPlayer.id]: fieldState(defPlayer.id, 'def-l', 'DEF', 12 * 60_000), // threshold 5min -> 7min over
    };

    const candidates = findExceededOutgoingCandidates({
      players: [midPlayer, defPlayer],
      playerStates,
      thresholds: DEFAULT_THRESHOLDS,
      goalkeeperRotationEnabled: false,
      rosterOrder: [midPlayer.id, defPlayer.id],
      positions,
    });

    expect(candidates[0].playerId).toBe(defPlayer.id);
    expect(candidates[1].playerId).toBe(midPlayer.id);
  });

  it('excludes goalkeepers unless rotation is enabled', () => {
    const gk = makePlayer({ name: 'GK', jerseyNumber: 1, preferredGroup: 'GK' });
    const playerStates = { [gk.id]: fieldState(gk.id, 'gk', 'GK', 20 * 60_000) };
    const thresholds = { ...DEFAULT_THRESHOLDS, GK: { enabled: true, minutes: 5 } };

    const withoutRotation = findExceededOutgoingCandidates({
      players: [gk],
      playerStates,
      thresholds,
      goalkeeperRotationEnabled: false,
      rosterOrder: [gk.id],
      positions,
    });
    expect(withoutRotation).toHaveLength(0);

    const withRotation = findExceededOutgoingCandidates({
      players: [gk],
      playerStates,
      thresholds,
      goalkeeperRotationEnabled: true,
      rosterOrder: [gk.id],
      positions,
    });
    expect(withRotation).toHaveLength(1);
  });

  it('does not flag a player who has not reached the threshold', () => {
    const midPlayer = makePlayer({ name: 'Mid', jerseyNumber: 5, preferredGroup: 'MID' });
    const playerStates = { [midPlayer.id]: fieldState(midPlayer.id, 'mid-c', 'MID', 60_000) };
    const candidates = findExceededOutgoingCandidates({
      players: [midPlayer],
      playerStates,
      thresholds: DEFAULT_THRESHOLDS,
      goalkeeperRotationEnabled: false,
      rosterOrder: [midPlayer.id],
      positions,
    });
    expect(candidates).toHaveLength(0);
  });
});

describe('recommendIncomingPlayer', () => {
  it('prefers a bench player whose preferred group matches the open position', () => {
    const matching = makePlayer({ name: 'Matching', jerseyNumber: 10, preferredGroup: 'MID' });
    const nonMatching = makePlayer({ name: 'NonMatching', jerseyNumber: 11, preferredGroup: 'FWD' });
    const playerStates = {
      [matching.id]: benchState(matching.id, 2 * 60_000),
      [nonMatching.id]: benchState(nonMatching.id, 5 * 60_000), // longer bench time but wrong group
    };

    const result = recommendIncomingPlayer('mid-c', {
      players: [matching, nonMatching],
      playerStates,
      thresholds: DEFAULT_THRESHOLDS,
      goalkeeperRotationEnabled: false,
      rosterOrder: [matching.id, nonMatching.id],
      positions,
    });

    expect(result?.playerId).toBe(matching.id);
  });

  it('breaks ties by longest bench stint, then lowest total playing time, then roster order', () => {
    const a = makePlayer({ name: 'A', jerseyNumber: 10, preferredGroup: 'MID' });
    const b = makePlayer({ name: 'B', jerseyNumber: 11, preferredGroup: 'MID' });
    const playerStates = {
      [a.id]: benchState(a.id, 3 * 60_000, 10 * 60_000),
      [b.id]: benchState(b.id, 5 * 60_000, 20 * 60_000), // longer bench stint wins
    };

    const result = recommendIncomingPlayer('mid-c', {
      players: [a, b],
      playerStates,
      thresholds: DEFAULT_THRESHOLDS,
      goalkeeperRotationEnabled: false,
      rosterOrder: [a.id, b.id],
      positions,
    });
    expect(result?.playerId).toBe(b.id);
  });

  it('returns null when there are no bench candidates', () => {
    const result = recommendIncomingPlayer('mid-c', {
      players: [],
      playerStates: {},
      thresholds: DEFAULT_THRESHOLDS,
      goalkeeperRotationEnabled: false,
      rosterOrder: [],
      positions,
    });
    expect(result).toBeNull();
  });
});

describe('recommendSubstitution', () => {
  it('produces a full recommendation combining outgoing and incoming players', () => {
    const outgoing = makePlayer({ name: 'Jordan', jerseyNumber: 4, preferredGroup: 'MID' });
    const incoming = makePlayer({ name: 'Maya', jerseyNumber: 8, preferredGroup: 'MID' });
    const playerStates = {
      [outgoing.id]: fieldState(outgoing.id, 'mid-c', 'MID', 10 * 60_000),
      [incoming.id]: benchState(incoming.id, 6 * 60_000),
    };

    const rec = recommendSubstitution({
      players: [outgoing, incoming],
      playerStates,
      thresholds: DEFAULT_THRESHOLDS,
      goalkeeperRotationEnabled: false,
      rosterOrder: [outgoing.id, incoming.id],
      positions,
    });

    expect(rec?.outgoingPlayerId).toBe(outgoing.id);
    expect(rec?.incomingPlayerId).toBe(incoming.id);
    expect(rec?.explanation).toContain('Maya');
    expect(rec?.explanation).toContain('Jordan');
  });
});
