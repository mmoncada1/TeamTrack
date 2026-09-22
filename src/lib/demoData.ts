import type { Player, PositionGroup } from '../types';
import { createId } from './id';

const DEMO_NAMES: { name: string; group: PositionGroup }[] = [
  { name: 'Alex Rivera', group: 'GK' },
  { name: 'Jordan Lee', group: 'DEF' },
  { name: 'Sam Okafor', group: 'DEF' },
  { name: 'Casey Nguyen', group: 'DEF' },
  { name: 'Maya Torres', group: 'MID' },
  { name: 'Priya Shah', group: 'MID' },
  { name: 'Liam Fischer', group: 'MID' },
  { name: 'Noah Kim', group: 'FWD' },
  { name: 'Ella Martin', group: 'FWD' },
  { name: 'Diego Santos', group: 'DEF' },
  { name: 'Grace Wallace', group: 'MID' },
  { name: 'Theo Brandt', group: 'FWD' },
];

/** Build a fresh demo roster (12 players covering every position group). */
export function buildDemoRoster(teamId: string): Player[] {
  const now = Date.now();
  return DEMO_NAMES.map((entry, index) => ({
    id: createId(),
    teamId,
    name: entry.name,
    jerseyNumber: index + 1,
    preferredGroup: entry.group,
    availability: 'active' as const,
    createdAt: now,
    updatedAt: now,
  }));
}
