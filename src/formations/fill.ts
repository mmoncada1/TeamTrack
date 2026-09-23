import type { Assignment, Formation, Player, PositionGroup } from '../types';
import { comparePlayersByJersey } from '../lib/playerSort';
import { playerPositionGroups } from '../lib/playerPositions';

export interface FillResult {
  assignments: Assignment;
  summary: string;
}

function compareForSlot(a: Player, b: Player, group: PositionGroup): number {
  const aGroups = playerPositionGroups(a);
  const bGroups = playerPositionGroups(b);
  const aPrimary = aGroups[0] === group ? 0 : 1;
  const bPrimary = bGroups[0] === group ? 0 : 1;
  if (aPrimary !== bPrimary) return aPrimary - bPrimary;
  const aOnly = aGroups.length === 1 ? 0 : 1;
  const bOnly = bGroups.length === 1 ? 0 : 1;
  if (aOnly !== bOnly) return aOnly - bOnly;
  return comparePlayersByJersey(a, b);
}

/**
 * Place roster players into formation slots using each player's positions.
 * A player who lists the slot as their first position is chosen before
 * someone who only lists it as an extra. Within that, lower jersey numbers
 * go first. Extra players stay on the bench. A player is never assigned twice.
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

  const used = new Set<string>();
  const assignments: Assignment = {};
  for (const position of formation.positions) {
    const player = eligible
      .filter((candidate) => !used.has(candidate.id) && playerPositionGroups(candidate).includes(position.group))
      .sort((a, b) => compareForSlot(a, b, position.group))[0];
    if (!player) continue;
    used.add(player.id);
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
