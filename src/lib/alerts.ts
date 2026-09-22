import type { Alert, FormationPosition, Player, PlayerRuntimeState, ThresholdSettings } from '../types';
import { createId } from './id';
import { minutesToMs } from './timer';
import { recommendIncomingPlayer } from './recommendations';

export interface UpdateAlertsParams {
  existingAlerts: Alert[];
  playerStates: Record<string, PlayerRuntimeState>;
  players: Player[];
  thresholds: ThresholdSettings;
  goalkeeperRotationEnabled: boolean;
  positions: FormationPosition[];
  rosterOrder: string[];
  matchClockMs: number;
}

export interface UpdateAlertsResult {
  alerts: Alert[];
  newAlertIds: string[];
}

/**
 * Recompute the set of active/snoozed threshold alerts.
 *
 * Deduplication: an alert is keyed by (playerId, stintStartMs). As long as a
 * player's *current* on-field stint hasn't changed, we never create a
 * second alert for it, no matter how many times this is called (e.g. once
 * per second from the match clock tick).
 */
export function updateAlerts(params: UpdateAlertsParams): UpdateAlertsResult {
  const { existingAlerts, playerStates, players, thresholds, goalkeeperRotationEnabled, positions, rosterOrder, matchClockMs } =
    params;

  const playersById = new Map(players.map((p) => [p.id, p]));
  const newAlertIds: string[] = [];
  const result: Alert[] = [];
  const claimedIncoming = new Set<string>();

  const recommendationContext = {
    players,
    playerStates,
    thresholds,
    goalkeeperRotationEnabled,
    rosterOrder,
    positions,
    excludePlayerIds: claimedIncoming,
  };

  function nextRecommendation(positionId: string | null | undefined) {
    if (!positionId) return undefined;
    const recommendation = recommendIncomingPlayer(positionId, recommendationContext);
    if (!recommendation) return undefined;
    claimedIncoming.add(recommendation.playerId);
    return { inPlayerId: recommendation.playerId, explanation: recommendation.explanation };
  }

  // Carry forward alerts that are still relevant (player still on field, same stint).
  // Dismissed alerts stay stored for that stint so the next tick does not recreate them.
  for (const alert of existingAlerts) {
    if (alert.status === 'resolved') continue;
    const state = playerStates[alert.playerId];
    const stillOnSameStint =
      state && state.status === 'field' && state.currentStintStartMs === alert.stintStartMs;
    if (!stillOnSameStint) continue; // player subbed out / moved -> alert auto-resolves

    if (alert.status === 'dismissed') {
      result.push(alert);
      continue;
    }

    let status = alert.status;
    if (status === 'snoozed' && alert.snoozeUntilClockMs != null && matchClockMs >= alert.snoozeUntilClockMs) {
      status = 'active';
    }
    result.push({
      ...alert,
      status,
      recommendation: nextRecommendation(state.positionId),
    });
  }

  const existingKeys = new Set(result.map((a) => `${a.playerId}:${a.stintStartMs}`));

  for (const state of Object.values(playerStates)) {
    if (state.status !== 'field' || !state.positionId || !state.positionGroup) continue;
    if (state.positionGroup === 'GK' && !goalkeeperRotationEnabled) continue;
    const player = playersById.get(state.playerId);
    if (!player) continue;

    const threshold = thresholds[state.positionGroup];
    if (!threshold?.enabled) continue;

    const thresholdMs = minutesToMs(threshold.minutes);
    if (state.currentStintMs < thresholdMs) continue;
    if (state.currentStintStartMs == null) continue;

    const key = `${state.playerId}:${state.currentStintStartMs}`;
    if (existingKeys.has(key)) continue;

    const alert: Alert = {
      id: createId(),
      playerId: state.playerId,
      positionGroup: state.positionGroup,
      thresholdMinutes: threshold.minutes,
      stintStartMs: state.currentStintStartMs,
      createdAtClockMs: matchClockMs,
      status: 'active',
      recommendation: nextRecommendation(state.positionId),
    };
    result.push(alert);
    newAlertIds.push(alert.id);
    existingKeys.add(key);
  }

  return { alerts: result, newAlertIds };
}
