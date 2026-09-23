import type { FormationPosition, Player, PlayerGender, PlayerRuntimeState, PositionGroup, ThresholdSettings } from '../types';
import { minutesToMs } from './timer';
import { playerPositionGroups } from './playerPositions';

export interface RecommendationContext {
  players: Player[];
  playerStates: Record<string, PlayerRuntimeState>;
  thresholds: ThresholdSettings;
  goalkeeperRotationEnabled: boolean;
  /** Deterministic roster order, used only as a final tie-breaker. */
  rosterOrder: string[];
  positions: FormationPosition[];
  /** Bench players already recommended for another alert this pass. */
  excludePlayerIds?: ReadonlySet<string>;
  /**
   * When set, bench players of this gender rank first. Used so a co-ed sub
   * does not drop the number of girls on the field below the league minimum.
   */
  preferGender?: PlayerGender;
}

export interface ExceededCandidate {
  playerId: string;
  positionId: string;
  overageMs: number;
  thresholdMs: number;
}

/** Players currently on the field who have exceeded their group's threshold, ranked by overage (most overdue first). */
export function findExceededOutgoingCandidates(context: RecommendationContext): ExceededCandidate[] {
  const { players, playerStates, thresholds, goalkeeperRotationEnabled } = context;
  const playersById = new Map(players.map((p) => [p.id, p]));
  const candidates: ExceededCandidate[] = [];

  for (const state of Object.values(playerStates)) {
    if (state.status !== 'field' || !state.positionId || !state.positionGroup) continue;
    if (state.positionGroup === 'GK' && !goalkeeperRotationEnabled) continue;
    const player = playersById.get(state.playerId);
    if (!player) continue;

    const threshold = thresholds[state.positionGroup];
    if (!threshold?.enabled) continue;

    const thresholdMs = minutesToMs(threshold.minutes);
    if (state.currentStintMs >= thresholdMs) {
      candidates.push({
        playerId: state.playerId,
        positionId: state.positionId,
        overageMs: state.currentStintMs - thresholdMs,
        thresholdMs,
      });
    }
  }

  candidates.sort((a, b) => b.overageMs - a.overageMs);
  return candidates;
}

export interface IncomingRecommendation {
  playerId: string;
  explanation: string;
}

/**
 * Recommend the best bench player to replace `outgoingPlayerId` at
 * `positionId`. Ranking, in order:
 *   1. Available bench players only.
 *   2. Matching `preferGender`, when a co-ed minimum would otherwise be missed.
 *   3. Preferred position group matches the open position's group.
 *   4. Longest current bench stint.
 *   5. Lowest total playing time (totalFieldMs).
 *   6. Roster order (deterministic final tie-break).
 */
function matchesPosition(player: Player | undefined, positionGroup: PositionGroup): boolean {
  return !!player && playerPositionGroups(player).includes(positionGroup);
}

export function recommendIncomingPlayer(
  positionId: string,
  context: RecommendationContext,
): IncomingRecommendation | null {
  const { players, playerStates, rosterOrder, positions } = context;
  const position = positions.find((p) => p.id === positionId);
  const positionGroup = position?.group ?? null;
  const playersById = new Map(players.map((p) => [p.id, p]));
  const rosterIndex = new Map(rosterOrder.map((id, idx) => [id, idx]));

  const benchCandidates = Object.values(playerStates).filter((state) => {
    if (state.status !== 'bench') return false;
    if (context.excludePlayerIds?.has(state.playerId)) return false;
    return playersById.has(state.playerId);
  });

  if (benchCandidates.length === 0) return null;

  const sorted = [...benchCandidates].sort((a, b) => {
    if (context.preferGender) {
      const aGender = playersById.get(a.playerId)?.gender === context.preferGender;
      const bGender = playersById.get(b.playerId)?.gender === context.preferGender;
      if (aGender !== bGender) return aGender ? -1 : 1;
    }

    const aMatches = positionGroup != null && matchesPosition(playersById.get(a.playerId), positionGroup);
    const bMatches = positionGroup != null && matchesPosition(playersById.get(b.playerId), positionGroup);
    if (aMatches !== bMatches) return aMatches ? -1 : 1;

    if (a.currentStintMs !== b.currentStintMs) return b.currentStintMs - a.currentStintMs;

    if (a.totalFieldMs !== b.totalFieldMs) return a.totalFieldMs - b.totalFieldMs;

    const aIdx = rosterIndex.get(a.playerId) ?? Number.MAX_SAFE_INTEGER;
    const bIdx = rosterIndex.get(b.playerId) ?? Number.MAX_SAFE_INTEGER;
    return aIdx - bIdx;
  });

  const best = sorted[0];
  const bestPlayer = playersById.get(best.playerId);
  const matchesGroup = positionGroup != null && matchesPosition(bestPlayer, positionGroup);

  const benchMinutes = Math.round(best.currentStintMs / 60000);
  const reasonParts: string[] = [];
  if (context.preferGender && bestPlayer?.gender === context.preferGender) {
    reasonParts.push('keeps a girl on the field');
  }
  if (matchesGroup && position) {
    reasonParts.push(`matches the ${position.label.toLowerCase()} role`);
  }
  reasonParts.push(
    `has the longest current bench time (${benchMinutes} minute${benchMinutes === 1 ? '' : 's'})`,
  );

  return {
    playerId: best.playerId,
    explanation: reasonParts.join(' and '),
  };
}

export interface SubstitutionRecommendation {
  outgoingPlayerId: string;
  incomingPlayerId: string;
  positionId: string;
  explanation: string;
}

/** Full recommendation combining the most-overdue outgoing player with the best incoming replacement. */
export function recommendSubstitution(context: RecommendationContext): SubstitutionRecommendation | null {
  const outgoingCandidates = findExceededOutgoingCandidates(context);
  const playersById = new Map(context.players.map((p) => [p.id, p]));

  for (const candidate of outgoingCandidates) {
    const incoming = recommendIncomingPlayer(candidate.positionId, context);
    if (!incoming) continue;

    const outPlayer = playersById.get(candidate.playerId);
    const inPlayer = playersById.get(incoming.playerId);
    const position = context.positions.find((p) => p.id === candidate.positionId);

    const explanation = `Recommended: ${inPlayer?.name ?? 'Unknown'} for ${outPlayer?.name ?? 'Unknown'} at ${
      position?.label ?? candidate.positionId
    }. ${inPlayer?.name ?? 'The player'} ${incoming.explanation}.`;

    return {
      outgoingPlayerId: candidate.playerId,
      incomingPlayerId: incoming.playerId,
      positionId: candidate.positionId,
      explanation,
    };
  }

  return null;
}

/** Recommend an incoming player for a specific, already-chosen outgoing player (manual override support). */
export function recommendIncomingForPlayer(
  outgoingPlayerId: string,
  context: RecommendationContext,
): IncomingRecommendation | null {
  const outgoingState = context.playerStates[outgoingPlayerId];
  if (!outgoingState?.positionId) return null;
  return recommendIncomingPlayer(outgoingState.positionId, context);
}
