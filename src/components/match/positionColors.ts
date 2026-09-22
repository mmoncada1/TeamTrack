import type { PositionGroup } from '../../types';

/**
 * Colors follow the player's preferred position on the roster, not the
 * formation slot they are currently standing in. The abbreviation is always
 * shown as well, so position is never communicated by color alone.
 */
export const POSITION_COLORS: Record<
  PositionGroup,
  { abbr: string; ring: string; badge: string; swatch: string }
> = {
  GK: {
    abbr: 'GK',
    ring: 'ring-amber-400',
    badge: 'bg-amber-400 text-slate-950',
    swatch: 'bg-amber-400',
  },
  DEF: {
    abbr: 'DEF',
    ring: 'ring-sky-400',
    badge: 'bg-sky-600 text-white',
    swatch: 'bg-sky-600',
  },
  MID: {
    abbr: 'MID',
    ring: 'ring-violet-400',
    badge: 'bg-violet-600 text-white',
    swatch: 'bg-violet-600',
  },
  FWD: {
    abbr: 'FWD',
    ring: 'ring-orange-500',
    badge: 'bg-orange-500 text-white',
    swatch: 'bg-orange-500',
  },
};

export const POSITION_COLOR_ORDER: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];
