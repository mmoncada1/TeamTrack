import type { Player, PositionGroup } from '../types';
import { POSITION_GROUP_LABELS } from '../types';

const ORDER: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];

function isGroup(value: unknown): value is PositionGroup {
  return value === 'GK' || value === 'DEF' || value === 'MID' || value === 'FWD';
}

/** Every position a player can play. Older records only stored one. */
export function playerPositionGroups(player: Pick<Player, 'preferredGroup' | 'preferredGroups'>): PositionGroup[] {
  const listed = (player.preferredGroups ?? []).filter(isGroup);
  const unique: PositionGroup[] = [];
  for (const group of listed) {
    if (!unique.includes(group)) unique.push(group);
  }
  if (unique.length > 0) return unique;
  return isGroup(player.preferredGroup) ? [player.preferredGroup] : [];
}

/** First selected position. Token color follows this one. */
export function primaryPositionGroup(player: Pick<Player, 'preferredGroup' | 'preferredGroups'>): PositionGroup {
  return playerPositionGroups(player)[0] ?? player.preferredGroup ?? 'MID';
}

export function positionAbbreviations(player: Pick<Player, 'preferredGroup' | 'preferredGroups'>): string {
  const groups = playerPositionGroups(player);
  return (groups.length > 0 ? groups : ORDER.slice(2, 3)).join('/');
}

export function positionNames(player: Pick<Player, 'preferredGroup' | 'preferredGroups'>): string {
  return playerPositionGroups(player).map((group) => POSITION_GROUP_LABELS[group]).join(', ');
}

export function withPositionGroups<T extends Pick<Player, 'preferredGroup' | 'preferredGroups'>>(player: T): T {
  const groups = playerPositionGroups(player);
  if (groups.length === 0) return player;
  return { ...player, preferredGroup: groups[0], preferredGroups: groups };
}

/** Drop unknown values and keep the coach's selection order. */
export function normalizePositionGroups(groups: readonly PositionGroup[]): PositionGroup[] {
  const unique: PositionGroup[] = [];
  for (const group of groups) {
    if (isGroup(group) && !unique.includes(group)) unique.push(group);
  }
  return unique;
}
