import type {
  AppBackup,
  AppSettings,
  Match,
  Player,
  PlayerPhoto,
  PlayingTimeSummary,
  SavedLineup,
  Team,
  TeamPhoto,
} from '../types';
import { isValidPlayerRecord, mergeAppSettingsWithDefaults } from './validation';
import { withPositionGroups } from './playerPositions';
import { formatClock } from './timer';
import { createId } from './id';
import { blobToDataUrl, dataUrlToBlob } from './photo';

export const BACKUP_VERSION = 5;

/** JSON-safe representation of a PlayerPhoto for the exported backup file (blob -> data URL). */
interface SerializedPhoto {
  id: string;
  playerId: string;
  mimeType: string;
  width: number;
  height: number;
  createdAt: number;
  dataUrl: string;
}

interface SerializedTeamPhoto {
  id: string;
  teamId: string;
  mimeType: string;
  width: number;
  height: number;
  createdAt: number;
  dataUrl: string;
}

async function serializePhotos(photos: PlayerPhoto[]): Promise<SerializedPhoto[]> {
  return Promise.all(
    photos.map(async (photo) => ({
      id: photo.id,
      playerId: photo.playerId,
      mimeType: photo.mimeType,
      width: photo.width,
      height: photo.height,
      createdAt: photo.createdAt,
      dataUrl: await blobToDataUrl(photo.blob),
    })),
  );
}

async function serializeTeamPhotos(photos: TeamPhoto[]): Promise<SerializedTeamPhoto[]> {
  return Promise.all(
    photos.map(async (photo) => ({
      id: photo.id,
      teamId: photo.teamId,
      mimeType: photo.mimeType,
      width: photo.width,
      height: photo.height,
      createdAt: photo.createdAt,
      dataUrl: await blobToDataUrl(photo.blob),
    })),
  );
}

export async function buildBackup(
  teams: Team[],
  players: Player[],
  matches: Match[],
  settings: AppSettings,
  photos: PlayerPhoto[],
  teamPhotos: TeamPhoto[] = [],
  lineups: SavedLineup[] = [],
): Promise<Record<string, unknown>> {
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    teams,
    players,
    matches,
    photos: await serializePhotos(photos),
    teamPhotos: await serializeTeamPhotos(teamPhotos),
    lineups,
    settings,
  };
}

export function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function exportBackupAsJson(
  teams: Team[],
  players: Player[],
  matches: Match[],
  settings: AppSettings,
  photos: PlayerPhoto[],
  teamPhotos: TeamPhoto[] = [],
  lineups: SavedLineup[] = [],
): Promise<void> {
  const backup = await buildBackup(teams, players, matches, settings, photos, teamPhotos, lineups);
  triggerDownload(
    `teamtrack-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(backup, null, 2),
    'application/json',
  );
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function summariesToCsv(summaries: PlayingTimeSummary[]): string {
  const headers = [
    'Jersey #',
    'Player',
    'Status',
    'Minutes Played',
    'Minutes Benched',
    'Goals',
    'Assists',
    'Subs In',
    'Subs Out',
  ];
  const rows = summaries.map((s) => [
    s.jerseyNumber ?? '',
    s.playerName,
    s.status,
    (s.totalFieldMs / 60000).toFixed(1),
    (s.totalBenchMs / 60000).toFixed(1),
    s.goals,
    s.assists,
    s.subsIn,
    s.subsOut,
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function exportPlayerSummaryAsCsv(matchLabel: string, summaries: PlayingTimeSummary[]): void {
  const csv = summariesToCsv(summaries);
  triggerDownload(`teamtrack-${matchLabel}-summary.csv`, csv, 'text/csv');
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  backup?: AppBackup;
}

/** Validate an imported JSON backup before it's allowed to replace local data. */
export function validateBackup(raw: unknown): BackupValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['File does not contain a valid JSON object.'] };
  }
  const obj = raw as Partial<AppBackup>;

  if (typeof obj.version !== 'number') {
    errors.push('Missing or invalid backup version.');
  }
  if (!Array.isArray(obj.players)) {
    errors.push('Missing or invalid "players" array.');
  }
  if (!Array.isArray(obj.matches)) {
    errors.push('Missing or invalid "matches" array.');
  }

  if (errors.length > 0 && (!Array.isArray(obj.players) || !Array.isArray(obj.matches))) {
    return { valid: false, errors };
  }

  const rawTeams = Array.isArray(obj.teams) ? obj.teams : [];
  const teams: Team[] = rawTeams.filter(
    (team): team is Team =>
      !!team &&
      typeof team === 'object' &&
      typeof (team as Team).id === 'string' &&
      typeof (team as Team).name === 'string' &&
      (team as Team).name.trim().length > 0,
  );
  if (teams.length === 0) {
    const now = Date.now();
    teams.push({ id: createId(), name: 'Imported team', createdAt: now, updatedAt: now });
  }
  const teamIds = new Set(teams.map((team) => team.id));
  const fallbackTeamId = teams[0].id;

  const stampedPlayers = (obj.players ?? []).map((player) => {
    if (!player || typeof player !== 'object') return player;
    const record = player as Partial<Player>;
    const teamId = typeof record.teamId === 'string' && teamIds.has(record.teamId) ? record.teamId : fallbackTeamId;
    return { ...record, teamId };
  });
  const invalidCount = stampedPlayers.filter((player) => !isValidPlayerRecord(player)).length;
  if (invalidCount > 0) {
    errors.push(`${invalidCount} player record(s) are invalid and would be skipped.`);
  }

  const players = stampedPlayers.filter(isValidPlayerRecord).map((player) =>
    withPositionGroups({
      ...player,
      teamId: player.teamId && teamIds.has(player.teamId) ? player.teamId : fallbackTeamId,
    }),
  );
  const matches = (Array.isArray(obj.matches) ? (obj.matches as Match[]) : []).map((match) => ({
    ...match,
    teamId: match.teamId && teamIds.has(match.teamId) ? match.teamId : fallbackTeamId,
  }));
  const settings = mergeAppSettingsWithDefaults(obj.settings);

  const playerIds = new Set(players.map((p) => p.id));
  const rawPhotos = Array.isArray((obj as { photos?: unknown }).photos) ? (obj as { photos: unknown[] }).photos : [];
  let skippedPhotoCount = 0;
  const photos: PlayerPhoto[] = rawPhotos.flatMap((entry) => {
    const p = entry as Partial<SerializedPhoto>;
    if (
      !p ||
      typeof p.id !== 'string' ||
      typeof p.playerId !== 'string' ||
      typeof p.dataUrl !== 'string' ||
      typeof p.mimeType !== 'string' ||
      typeof p.width !== 'number' ||
      typeof p.height !== 'number'
    ) {
      skippedPhotoCount += 1;
      return [];
    }
    if (!playerIds.has(p.playerId)) {
      skippedPhotoCount += 1;
      return [];
    }
    try {
      return [
        {
          id: p.id,
          playerId: p.playerId,
          mimeType: p.mimeType,
          width: p.width,
          height: p.height,
          createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
          blob: dataUrlToBlob(p.dataUrl),
        },
      ];
    } catch {
      skippedPhotoCount += 1;
      return [];
    }
  });
  if (skippedPhotoCount > 0) {
    errors.push(`${skippedPhotoCount} photo(s) could not be imported and would be skipped.`);
  }

  const teamIdsForPhotos = new Set(teams.map((team) => team.id));
  const rawTeamPhotos = Array.isArray((obj as { teamPhotos?: unknown }).teamPhotos)
    ? (obj as { teamPhotos: unknown[] }).teamPhotos
    : [];
  let skippedTeamPhotoCount = 0;
  const teamPhotos: TeamPhoto[] = rawTeamPhotos.flatMap((entry) => {
    const p = entry as Partial<SerializedTeamPhoto>;
    if (
      !p ||
      typeof p.id !== 'string' ||
      typeof p.teamId !== 'string' ||
      typeof p.dataUrl !== 'string' ||
      typeof p.mimeType !== 'string' ||
      typeof p.width !== 'number' ||
      typeof p.height !== 'number'
    ) {
      skippedTeamPhotoCount += 1;
      return [];
    }
    if (!teamIdsForPhotos.has(p.teamId)) {
      skippedTeamPhotoCount += 1;
      return [];
    }
    try {
      return [
        {
          id: p.id,
          teamId: p.teamId,
          mimeType: p.mimeType,
          width: p.width,
          height: p.height,
          createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
          blob: dataUrlToBlob(p.dataUrl),
        },
      ];
    } catch {
      skippedTeamPhotoCount += 1;
      return [];
    }
  });
  if (skippedTeamPhotoCount > 0) {
    errors.push(`${skippedTeamPhotoCount} team photo(s) could not be imported and would be skipped.`);
  }

  const rawLineups = Array.isArray((obj as { lineups?: unknown }).lineups)
    ? (obj as { lineups: unknown[] }).lineups
    : [];
  let skippedLineupCount = 0;
  const lineups: SavedLineup[] = rawLineups.flatMap((entry) => {
    const l = entry as Partial<SavedLineup>;
    if (
      !l ||
      typeof l.id !== 'string' ||
      typeof l.teamId !== 'string' ||
      typeof l.name !== 'string' ||
      typeof l.formationId !== 'string' ||
      !l.assignments ||
      typeof l.assignments !== 'object' ||
      !teamIdsForPhotos.has(l.teamId)
    ) {
      skippedLineupCount += 1;
      return [];
    }
    const assignments = Object.fromEntries(
      Object.entries(l.assignments).filter(([, id]) => typeof id === 'string' && playerIds.has(id)),
    );
    return [
      {
        id: l.id,
        teamId: l.teamId,
        name: l.name,
        format: l.format ?? '7v7',
        formationId: l.formationId,
        assignments,
        createdAt: typeof l.createdAt === 'number' ? l.createdAt : Date.now(),
        updatedAt: typeof l.updatedAt === 'number' ? l.updatedAt : Date.now(),
      },
    ];
  });
  if (skippedLineupCount > 0) {
    errors.push(`${skippedLineupCount} lineup(s) could not be imported and would be skipped.`);
  }

  return {
    valid: true,
    errors,
    backup: {
      version: typeof obj.version === 'number' ? obj.version : BACKUP_VERSION,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
      teams,
      players,
      matches,
      photos,
      teamPhotos,
      lineups,
      settings,
    },
  };
}

export function formatMatchClockLabel(ms: number): string {
  return formatClock(ms);
}
