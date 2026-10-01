import type { Player, Team } from '../types';
import { teamSport } from '../lib/sports';
import type { FootballData } from './types';
import { isDrive, isFormation, isPlay, isWhiteboard } from './validation';

export function validateFootballBackup(
  raw: Record<string, unknown>,
  teams: Team[],
  players: Player[],
): { data: FootballData; errors: string[] } {
  const errors: string[] = [];
  const teamIds = new Set(teams.filter((t) => teamSport(t) === 'football').map((t) => t.id));
  function read<T extends { id: string; teamId: string }>(
    key: string,
    valid: (v: unknown) => v is T,
  ): T[] {
    if (raw[key] === undefined) return [];
    if (!Array.isArray(raw[key])) {
      errors.push(`Invalid ${key} array.`);
      return [];
    }
    const ids = new Set<string>();
    return raw[key].filter((value): value is T => {
      if (!valid(value) || !teamIds.has(value.teamId) || ids.has(value.id)) {
        errors.push(`Invalid or cross-team record in ${key}.`);
        return false;
      }
      ids.add(value.id);
      return true;
    });
  }
  const footballFormations = read('footballFormations', isFormation);
  const footballPlays = read('footballPlays', isPlay);
  const drivePlans = read('drivePlans', isDrive);
  const footballWhiteboards = read('footballWhiteboards', isWhiteboard);
  for (const formation of [...footballFormations, ...footballPlays]) {
    for (const slot of formation.players) {
      if (
        slot.rosterPlayerId &&
        !players.some((p) => p.id === slot.rosterPlayerId && p.teamId === formation.teamId)
      )
        errors.push('Football roster assignments must reference players on the same team.');
    }
  }
  for (const drive of drivePlans) {
    if (
      !drive.entries.every((e) =>
        footballPlays.some((p) => p.id === e.playId && p.teamId === drive.teamId),
      )
    )
      errors.push('Drive entries must reference plays on the same team.');
  }
  return { data: { footballFormations, footballPlays, drivePlans, footballWhiteboards }, errors };
}
