import type { Team } from '../types';

export type Sport = 'soccer' | 'football';
export const SPORT_LABELS: Record<Sport, string> = { soccer: 'Soccer', football: 'Football' };
/** Legacy records and callers without a sport retain the soccer experience. */
export function teamSport(team: Pick<Team, 'sport'> | null | undefined): Sport {
  return team?.sport ?? 'soccer';
}
