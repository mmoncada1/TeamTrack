import type { Match, Player, PlayingTimeSummary } from '../types';
import { deriveMatchState } from './matchEngine';
import { compareSummariesByJersey } from './playerSort';

export interface MatchSummaryData {
  summaries: PlayingTimeSummary[];
  averageFieldMs: number;
  /** Players whose total field time is substantially below the team average (a planning aid, not a judgment). */
  belowAveragePlayerIds: string[];
  teamScore: number;
  opponentScore: number;
  matchClockMs: number;
}

/** A player is flagged when their field time is below this fraction of the team average. */
const BELOW_AVERAGE_RATIO = 0.7;

export function buildMatchSummary(match: Match, players: Player[], nowMs: number = Date.now()): MatchSummaryData {
  const derived = deriveMatchState(match, nowMs);
  const playersById = new Map(players.map((p) => [p.id, p]));

  const summaries: PlayingTimeSummary[] = match.rosterPlayerIds
    .map((playerId): PlayingTimeSummary | null => {
      const state = derived.playerStates[playerId];
      const player = playersById.get(playerId);
      if (!state || !player) return null;
      return {
        ...state,
        playerName: player.name,
        jerseyNumber: player.jerseyNumber,
      };
    })
    .filter((s): s is PlayingTimeSummary => s !== null)
    .sort(compareSummariesByJersey);

  const availableSummaries = summaries.filter((s) => s.status !== 'unavailable');
  const averageFieldMs =
    availableSummaries.length > 0
      ? availableSummaries.reduce((sum, s) => sum + s.totalFieldMs, 0) / availableSummaries.length
      : 0;

  const belowAveragePlayerIds = availableSummaries
    .filter((s) => averageFieldMs > 0 && s.totalFieldMs < averageFieldMs * BELOW_AVERAGE_RATIO)
    .map((s) => s.playerId);

  return {
    summaries,
    averageFieldMs,
    belowAveragePlayerIds,
    teamScore: derived.teamScore,
    opponentScore: derived.opponentScore,
    matchClockMs: derived.matchClockMs,
  };
}
