import type { AppBackup, AppSettings, Match, Player, PlayingTimeSummary } from '../types';
import { isValidPlayerRecord, mergeAppSettingsWithDefaults } from './validation';
import { formatClock } from './timer';

export const BACKUP_VERSION = 1;

export function buildBackup(players: Player[], matches: Match[], settings: AppSettings): AppBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    players,
    matches,
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

export function exportBackupAsJson(players: Player[], matches: Match[], settings: AppSettings): void {
  const backup = buildBackup(players, matches, settings);
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
  } else {
    const invalidCount = obj.players.filter((p) => !isValidPlayerRecord(p)).length;
    if (invalidCount > 0) {
      errors.push(`${invalidCount} player record(s) are invalid and would be skipped.`);
    }
  }
  if (!Array.isArray(obj.matches)) {
    errors.push('Missing or invalid "matches" array.');
  }

  if (errors.length > 0 && (!Array.isArray(obj.players) || !Array.isArray(obj.matches))) {
    return { valid: false, errors };
  }

  const players = (obj.players ?? []).filter(isValidPlayerRecord);
  const matches = Array.isArray(obj.matches) ? (obj.matches as Match[]) : [];
  const settings = mergeAppSettingsWithDefaults(obj.settings);

  return {
    valid: true,
    errors,
    backup: { version: obj.version ?? BACKUP_VERSION, exportedAt: obj.exportedAt ?? Date.now(), players, matches, settings },
  };
}

export function formatMatchClockLabel(ms: number): string {
  return formatClock(ms);
}
