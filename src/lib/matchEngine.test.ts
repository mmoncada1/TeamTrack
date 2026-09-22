import { describe, expect, it } from 'vitest';
import { makeMatch, makePlayer } from './testHelpers';
import { deriveMatchState } from './matchEngine';
import { startMatch, substitutePlayer, pauseMatch, resumeMatch, recordGoal, deleteEvent } from './matchActions';

function setup() {
  const gk = makePlayer({ name: 'Goalie', jerseyNumber: 1, preferredGroup: 'GK' });
  const defL = makePlayer({ name: 'Defender L', jerseyNumber: 2, preferredGroup: 'DEF' });
  const defR = makePlayer({ name: 'Defender R', jerseyNumber: 3, preferredGroup: 'DEF' });
  const midL = makePlayer({ name: 'Mid L', jerseyNumber: 4, preferredGroup: 'MID' });
  const midC = makePlayer({ name: 'Mid C', jerseyNumber: 5, preferredGroup: 'MID' });
  const midR = makePlayer({ name: 'Mid R', jerseyNumber: 6, preferredGroup: 'MID' });
  const fwd = makePlayer({ name: 'Forward', jerseyNumber: 7, preferredGroup: 'FWD' });
  const benchA = makePlayer({ name: 'Bench A', jerseyNumber: 8, preferredGroup: 'MID' });
  const benchB = makePlayer({ name: 'Bench B', jerseyNumber: 9, preferredGroup: 'FWD' });

  const players = [gk, defL, defR, midL, midC, midR, fwd, benchA, benchB];
  const match = makeMatch({
    rosterPlayerIds: players.map((p) => p.id),
    pendingFormationId: '7v7-2-3-1',
    pendingAssignments: {
      gk: gk.id,
      'def-l': defL.id,
      'def-r': defR.id,
      'mid-l': midL.id,
      'mid-c': midC.id,
      'mid-r': midR.id,
      'fwd-c': fwd.id,
    },
  });

  return { match, players, gk, defL, defR, midL, midC, midR, fwd, benchA, benchB };
}

describe('deriveMatchState', () => {
  it('tracks playing time totals correctly after a substitution', () => {
    const { match, midC, benchA } = setup();
    const t0 = 0;
    let m = startMatch(match, t0);
    // midC plays 4 minutes, then is substituted for benchA.
    m = substitutePlayer(m, benchA.id, 'mid-c', t0 + 4 * 60_000);

    const derived = deriveMatchState(m, t0 + 6 * 60_000);
    const midCState = derived.playerStates[midC.id];
    const benchAState = derived.playerStates[benchA.id];

    expect(midCState.totalFieldMs).toBe(4 * 60_000);
    expect(midCState.status).toBe('bench');
    expect(midCState.subsOut).toBe(1);

    expect(benchAState.status).toBe('field');
    expect(benchAState.subsIn).toBe(1);
    expect(benchAState.totalFieldMs).toBe(2 * 60_000); // played from minute 4 to minute 6
    expect(benchAState.totalBenchMs).toBe(4 * 60_000); // benched from 0 to minute 4
  });

  it('does not accrue field or bench time while the match is paused', () => {
    const { match, midC } = setup();
    const t0 = 0;
    let m = startMatch(match, t0);
    m = pauseMatch(m, t0 + 5 * 60_000); // 5 min elapsed
    // Simulate a long real-world pause (10 minutes of wall-clock time passing).
    const derivedWhilePaused = deriveMatchState(m, t0 + 15 * 60_000);
    expect(derivedWhilePaused.playerStates[midC.id].totalFieldMs).toBe(5 * 60_000);
    expect(derivedWhilePaused.matchClockMs).toBe(5 * 60_000);

    m = resumeMatch(m, t0 + 15 * 60_000);
    const derivedAfterResume = deriveMatchState(m, t0 + 16 * 60_000);
    expect(derivedAfterResume.playerStates[midC.id].totalFieldMs).toBe(6 * 60_000);
  });

  it('accumulates multiple substitutions correctly for total minutes and sub counts', () => {
    const { match, midC, benchA, benchB } = setup();
    const t0 = 0;
    let m = startMatch(match, t0);
    m = substitutePlayer(m, benchA.id, 'mid-c', t0 + 3 * 60_000); // benchA in for midC
    m = substitutePlayer(m, benchB.id, 'mid-c', t0 + 6 * 60_000); // benchB in for benchA
    m = substitutePlayer(m, midC.id, 'mid-c', t0 + 8 * 60_000); // midC back in for benchB

    const derived = deriveMatchState(m, t0 + 10 * 60_000);
    const midCState = derived.playerStates[midC.id];
    const benchAState = derived.playerStates[benchA.id];
    const benchBState = derived.playerStates[benchB.id];

    expect(midCState.totalFieldMs).toBe((3 + 2) * 60_000); // 0-3 and 8-10
    expect(midCState.subsOut).toBe(1);
    expect(midCState.subsIn).toBe(1);

    expect(benchAState.totalFieldMs).toBe(3 * 60_000); // 3-6
    expect(benchAState.subsIn).toBe(1);
    expect(benchAState.subsOut).toBe(1);

    expect(benchBState.totalFieldMs).toBe(2 * 60_000); // 6-8
    expect(benchBState.subsIn).toBe(1);
    expect(benchBState.subsOut).toBe(1);
  });

  it('recalculates score correctly after a goal event is deleted', () => {
    const { match, fwd, midC } = setup();
    const t0 = 0;
    let m = startMatch(match, t0);
    m = recordGoal(m, { team: 'us', isOwnGoal: false, scorerId: fwd.id, assisterId: midC.id }, t0 + 60_000);
    m = recordGoal(m, { team: 'opponent', isOwnGoal: false }, t0 + 90_000);

    let derived = deriveMatchState(m, t0 + 120_000);
    expect(derived.teamScore).toBe(1);
    expect(derived.opponentScore).toBe(1);
    expect(derived.playerStates[fwd.id].goals).toBe(1);
    expect(derived.playerStates[midC.id].assists).toBe(1);

    const goalEvent = m.events.find((e) => e.type === 'GOAL' && e.matchClockMs === 60_000)!;
    m = deleteEvent(m, goalEvent.id);

    derived = deriveMatchState(m, t0 + 120_000);
    expect(derived.teamScore).toBe(0);
    expect(derived.opponentScore).toBe(1);
    expect(derived.playerStates[fwd.id].goals).toBe(0);
    expect(derived.playerStates[midC.id].assists).toBe(0);
  });
});
