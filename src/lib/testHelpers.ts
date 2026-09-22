import type { Match, MatchSettings, Player, PositionGroup } from '../types';
import { DEFAULT_THRESHOLDS } from '../types';
import { createId } from './id';

export function makePlayer(overrides: Partial<Player> & { name: string; jerseyNumber: number }): Player {
  const now = Date.now();
  return {
    id: createId(),
    teamId: 'team',
    preferredGroup: 'MID' as PositionGroup,
    availability: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeSettings(overrides: Partial<MatchSettings> = {}): MatchSettings {
  return {
    format: '7v7',
    formationId: '7v7-2-3-1',
    halfLengthMinutes: 25,
    numberOfHalves: 2,
    thresholds: DEFAULT_THRESHOLDS,
    goalkeeperRotationEnabled: false,
    alertSoundEnabled: false,
    ...overrides,
  };
}

export function makeMatch(overrides: Partial<Match> = {}): Match {
  const now = Date.now();
  return {
    id: createId(),
    teamId: 'team',
    teamName: 'Test FC',
    opponentName: 'Rivals',
    date: '2026-01-01',
    settings: makeSettings(),
    rosterPlayerIds: [],
    unavailablePlayerIds: [],
    pendingAssignments: {},
    pendingFormationId: '7v7-2-3-1',
    events: [],
    activeAlerts: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
