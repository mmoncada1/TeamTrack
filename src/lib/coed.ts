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

export const TOO_MANY_GUYS_MESSAGE = 'Too many guys on the field';

/**
 * A guy may be on the field only after the required number of girls is already
 * out there. An all-girl or still-empty field is fine while those girls are
 * being placed.
 */
function tallyField(players: Player[], fieldPlayerIds: Iterable<string>): { girls: number; others: number } {
  const playersById = new Map(players.map((player) => [player.id, player]));
  let girls = 0;
  let others = 0;
  for (const playerId of fieldPlayerIds) {
    if (playersById.get(playerId)?.gender === 'girl') girls += 1;
    else others += 1;
  }
  return { girls, others };
}

export function fieldHasTooManyGuys(
  rule: CoedFieldRule | undefined,
  players: Player[],
  fieldPlayerIds: Iterable<string>,
): boolean {
  if (!rule) return false;
  const { girls, others } = tallyField(players, fieldPlayerIds);
  return others > 0 && girls < rule.minGirlsOnField;
}

/**
 * Block a change that leaves guys on the field without enough girls.
 * Adding a girl or taking a guy off is still allowed, so a lineup that is
 * already short can be repaired.
 */
export function moveLeavesTooManyGuys(
  rule: CoedFieldRule | undefined,
  players: Player[],
  beforeFieldPlayerIds: Iterable<string>,
  afterFieldPlayerIds: Iterable<string>,
): boolean {
  if (!rule || !fieldHasTooManyGuys(rule, players, afterFieldPlayerIds)) return false;
  const before = tallyField(players, beforeFieldPlayerIds);
  const after = tallyField(players, afterFieldPlayerIds);
  if (after.girls > before.girls) return false;
  if (after.others < before.others) return false;
  return true;
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
