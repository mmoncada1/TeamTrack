import type { Assignment, Formation } from '../types';

export interface RemapResult {
  newAssignments: Assignment;
  movedToBenchPlayerIds: string[];
  summary: string;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Remap player assignments from one formation to another.
 *
 * Strategy: greedily match occupied old positions to unclaimed new positions
 * in the same position group, preferring the closest geometric match. Any
 * player whose old position has no unclaimed same-group counterpart in the
 * new formation is moved to the bench. Never duplicates or drops a player.
 */
export function remapFormation(
  fromFormation: Formation,
  toFormation: Formation,
  assignments: Assignment,
): RemapResult {
  const newAssignments: Assignment = {};
  const movedToBenchPlayerIds: string[] = [];
  const claimedNewPositionIds = new Set<string>();

  const oldPositionsById = new Map(fromFormation.positions.map((p) => [p.id, p]));
  const occupiedOldPositions = Object.entries(assignments)
    .filter(([positionId, playerId]) => positionId !== 'BENCH' && !!playerId)
    .map(([positionId, playerId]) => ({
      positionId,
      playerId,
      pos: oldPositionsById.get(positionId),
    }))
    .filter((entry) => entry.pos !== undefined) as {
    positionId: string;
    playerId: string;
    pos: NonNullable<ReturnType<typeof oldPositionsById.get>>;
  }[];

  // Build all candidate (old, new) pairs within the same group, sorted by distance.
  const candidates: { oldEntry: (typeof occupiedOldPositions)[number]; newPositionId: string; dist: number }[] = [];
  for (const oldEntry of occupiedOldPositions) {
    for (const newPos of toFormation.positions) {
      if (newPos.group !== oldEntry.pos.group) continue;
      // Exact same position id is always the best possible match.
      const exact = newPos.id === oldEntry.positionId;
      candidates.push({
        oldEntry,
        newPositionId: newPos.id,
        dist: exact ? -1 : distance(oldEntry.pos, newPos),
      });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist);

  const matchedPlayerIds = new Set<string>();
  for (const candidate of candidates) {
    if (matchedPlayerIds.has(candidate.oldEntry.playerId)) continue;
    if (claimedNewPositionIds.has(candidate.newPositionId)) continue;
    newAssignments[candidate.newPositionId] = candidate.oldEntry.playerId;
    claimedNewPositionIds.add(candidate.newPositionId);
    matchedPlayerIds.add(candidate.oldEntry.playerId);
  }

  for (const oldEntry of occupiedOldPositions) {
    if (!matchedPlayerIds.has(oldEntry.playerId)) {
      movedToBenchPlayerIds.push(oldEntry.playerId);
    }
  }

  const summary =
    movedToBenchPlayerIds.length === 0
      ? `Switched to ${toFormation.shape}. All players kept their equivalent positions.`
      : `Switched to ${toFormation.shape}. ${movedToBenchPlayerIds.length} player${
          movedToBenchPlayerIds.length === 1 ? '' : 's'
        } moved to the bench (no equivalent position available).`;

  return { newAssignments, movedToBenchPlayerIds, summary };
}
