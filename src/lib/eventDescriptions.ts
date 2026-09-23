import type { MatchEvent, Player } from '../types';
import { getFormationById } from '../formations/definitions';
import { formatClock } from './timer';

function name(playersById: Map<string, Player>, id: string | undefined): string {
  if (!id) return 'Unknown player';
  return playersById.get(id)?.name ?? 'Unknown player';
}

function positionLabel(formationId: string, positionId: string): string {
  return getFormationById(formationId)?.positions.find((p) => p.id === positionId)?.label ?? positionId;
}

export function describeEvent(event: MatchEvent, playersById: Map<string, Player>, formationId: string): string {
  switch (event.type) {
    case 'MATCH_STARTED':
      return 'Match started.';
    case 'MATCH_PAUSED':
      return 'Match paused.';
    case 'MATCH_RESUMED':
      return 'Match resumed.';
    case 'HALF_TIME':
      return 'Half-time.';
    case 'SECOND_HALF_STARTED':
      return 'Second half started.';
    case 'FORMATION_CHANGED':
      return event.summary;
    case 'PLAYER_MOVED': {
      const to = event.toSlot === 'BENCH' ? 'the bench' : positionLabel(formationId, event.toSlot);
      return `${name(playersById, event.playerId)} moved to ${to}.`;
    }
    case 'PLAYERS_SWAPPED':
      return `${name(playersById, event.playerAId)} and ${name(playersById, event.playerBId)} swapped positions.`;
    case 'SUBSTITUTION':
      return `Substitution: ${name(playersById, event.playerInId)} on for ${name(
        playersById,
        event.playerOutId,
      )} at ${positionLabel(formationId, event.positionId)}.`;
    case 'PLAYER_JOINED':
      return `${name(playersById, event.playerId)} joined the match on the bench.`;
    case 'PLAYER_UNAVAILABLE':
      return `${name(playersById, event.playerId)} is injured and left the match.`;
    case 'PLAYER_AVAILABLE':
      return `${name(playersById, event.playerId)} returned to the bench.`;
    case 'PLAYER_REMOVED':
      return `${name(playersById, event.playerId)} was removed from the match.`;
    case 'GOAL': {
      if (event.isOwnGoal) return `Own goal (against us) involving ${name(playersById, event.scorerId)}.`;
      if (event.team === 'opponent') return 'Opponent goal.';
      const assist = event.assisterId ? ` (assist: ${name(playersById, event.assisterId)})` : '';
      return `Goal: ${name(playersById, event.scorerId)}${assist}.`;
    }
    case 'ALERT_DISMISSED':
      return `Alert for ${name(playersById, event.playerId)} ${event.action === 'dismiss' ? 'dismissed' : 'snoozed'}.`;
    case 'MATCH_ENDED':
      return 'Match ended.';
    case 'NOTE':
      return event.note ?? 'Note.';
    default:
      return 'Event.';
  }
}

/**
 * Time to show next to an event. After half-time the match clock resets, so
 * later events are shown as time elapsed in the second half.
 */
export function eventDisplayMs(events: MatchEvent[], event: MatchEvent): number {
  const halfIndex = events.findIndex((entry) => entry.type === 'HALF_TIME');
  if (halfIndex === -1) return event.matchClockMs;
  const eventIndex = events.findIndex((entry) => entry.id === event.id);
  if (eventIndex <= halfIndex) return event.matchClockMs;
  return Math.max(0, event.matchClockMs - events[halfIndex].matchClockMs);
}

export function eventTimeLabel(events: MatchEvent[], event: MatchEvent): string {
  return formatClock(eventDisplayMs(events, event));
}
