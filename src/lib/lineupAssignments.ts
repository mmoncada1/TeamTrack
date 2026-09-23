import type { Assignment, SlotId } from '../types';

/**
 * Move a player between the bench and formation slots. If the destination is
 * taken, the occupant goes to the player's old slot, or to the bench when the
 * player came from the bench. Never duplicates or drops a player.
 */
export function moveAssignment(assignments: Assignment, playerId: string, toSlot: SlotId): Assignment {
  const next: Assignment = { ...assignments };
  const fromSlot = (Object.keys(next).find((key) => next[key] === playerId) ?? 'BENCH') as SlotId;
  if (fromSlot === toSlot) return assignments;

  const occupantOfTarget = toSlot !== 'BENCH' ? next[toSlot] : undefined;

  if (fromSlot !== 'BENCH') delete next[fromSlot];
  if (toSlot !== 'BENCH') {
    if (occupantOfTarget && occupantOfTarget !== playerId && fromSlot !== 'BENCH') {
      next[fromSlot] = occupantOfTarget;
    }
    next[toSlot] = playerId;
  }
  return next;
}
