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

export function eventTimeLabel(event: MatchEvent): string {
  return formatClock(event.matchClockMs);
}
