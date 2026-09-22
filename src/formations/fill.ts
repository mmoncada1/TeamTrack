import type { Assignment, Formation, Player } from '../types';
import { comparePlayersByJersey } from '../lib/playerSort';

export interface FillResult {
  assignments: Assignment;
  summary: string;
}

/**
 * Place roster players into formation slots using each player's preferred
 * position group. Within a group, lower jersey numbers (then name) are
 * assigned first. Extra players stay on the bench. Slots with no matching
 * player are left open. A player is never assigned twice.
 */
export function fillFormationByPreference(
  formation: Formation,
  players: Player[],
  rosterPlayerIds: string[],
  unavailablePlayerIds: string[],
): FillResult {
  const roster = new Set(rosterPlayerIds);
  const unavailable = new Set(unavailablePlayerIds);
  const eligible = players
    .filter((player) => roster.has(player.id) && !unavailable.has(player.id))
    .sort(comparePlayersByJersey);

  const queues = new Map<Player['preferredGroup'], Player[]>();
  for (const player of eligible) {
    const queue = queues.get(player.preferredGroup) ?? [];
    queue.push(player);
    queues.set(player.preferredGroup, queue);
  }

  const assignments: Assignment = {};
  for (const position of formation.positions) {
    const queue = queues.get(position.group);
    const player = queue?.shift();
    if (!player) continue;
    assignments[position.id] = player.id;
  }

  const filled = Object.keys(assignments).length;
  const open = formation.positions.length - filled;
  const summary =
    open === 0
      ? `Filled ${formation.shape} with ${filled} players by preferred position.`
      : `Filled ${formation.shape} with ${filled} players by preferred position. ${open} position${open === 1 ? '' : 's'} left open.`;

  return { assignments, summary };
}
