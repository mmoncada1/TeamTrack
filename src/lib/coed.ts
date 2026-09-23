import type { Player, PlayerGender, PlayerRuntimeState } from '../types';

export const DEFAULT_MIN_GIRLS_ON_FIELD = 2;

export interface CoedFieldRule {
  minGirlsOnField: number;
}

/** Keep a coach-entered minimum inside a range that fits 7v7 through 11v11. */
export function clampMinGirls(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MIN_GIRLS_ON_FIELD;
  return Math.min(11, Math.max(1, Math.round(value)));
}

export function countGirlsOnField(
  players: Player[],
  playerStates: Record<string, Pick<PlayerRuntimeState, 'playerId' | 'status'>>,
): number {
  const playersById = new Map(players.map((player) => [player.id, player]));
  let count = 0;
  for (const state of Object.values(playerStates)) {
    if (state.status !== 'field') continue;
    if (playersById.get(state.playerId)?.gender === 'girl') count += 1;
  }
  return count;
}

/**
 * A co-ed sub should bring a girl on when the field is already short, or when
 * the player leaving is a girl and the team is sitting exactly on the minimum.
 */
export function shouldPreferGirlReplacement(
  rule: CoedFieldRule | undefined,
  girlsOnField: number,
  outgoingGender: PlayerGender | undefined,
): boolean {
  if (!rule) return false;
  if (girlsOnField < rule.minGirlsOnField) return true;
  return girlsOnField === rule.minGirlsOnField && outgoingGender === 'girl';
}

/** Girls who would be on the field after this one-for-one substitution. */
export function girlsAfterSubstitution(
  girlsOnField: number,
  outgoingGender: PlayerGender | undefined,
  incomingGender: PlayerGender | undefined,
): number {
  const leaving = outgoingGender === 'girl' ? 1 : 0;
  const arriving = incomingGender === 'girl' ? 1 : 0;
  return girlsOnField - leaving + arriving;
}
