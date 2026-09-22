import type {
  Assignment,
  AppSettings,
  MatchFormat,
  MatchSettings,
  Player,
  PositionGroup,
  ThresholdSettings,
} from '../types';
import { DEFAULT_APP_SETTINGS, DEFAULT_THRESHOLDS, MATCH_FORMAT_PLAYER_COUNT } from '../types';
import { getDefaultFormationForFormat, getFormationById } from '../formations/definitions';

const POSITION_GROUPS: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];
const MATCH_FORMATS: MatchFormat[] = ['7v7', '9v9', '11v11'];

export interface FieldError {
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Player validation (roster form)
// ---------------------------------------------------------------------------

export interface PlayerInput {
  name: string;
  /** Empty string / undefined means "no jersey number assigned". */
  jerseyNumber: number | string | undefined;
  preferredGroup: PositionGroup;
  notes?: string;
  availability: 'active' | 'unavailable';
}

export function validatePlayerInput(
  input: PlayerInput,
  existingPlayers: Player[],
  editingPlayerId?: string,
): FieldError[] {
  const errors: FieldError[] = [];
  const name = input.name.trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Name is required.' });
  }

  const jerseyRaw = input.jerseyNumber;
  const jerseyProvided = jerseyRaw !== undefined && jerseyRaw !== null && String(jerseyRaw).trim() !== '';
  if (jerseyProvided) {
    const jersey = Number(jerseyRaw);
    if (!Number.isFinite(jersey) || jersey < 0 || !Number.isInteger(jersey)) {
      errors.push({ field: 'jerseyNumber', message: 'Jersey number must be a non-negative whole number, or left blank.' });
    } else {
      const duplicate = existingPlayers.find(
        (p) => p.jerseyNumber === jersey && p.id !== editingPlayerId,
      );
      if (duplicate) {
        errors.push({
          field: 'jerseyNumber',
          message: `Jersey #${jersey} is already used by ${duplicate.name}.`,
        });
      }
    }
  }

  if (!POSITION_GROUPS.includes(input.preferredGroup)) {
    errors.push({ field: 'preferredGroup', message: 'Choose a preferred position group.' });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Match setup validation
// ---------------------------------------------------------------------------

export interface MatchSetupInput {
  teamName: string;
  opponentName: string;
  date: string;
  title?: string;
  format: MatchFormat;
  formationId: string;
  halfLengthMinutes: number;
  numberOfHalves: 1 | 2;
  rosterPlayerIds: string[];
  assignments: Assignment;
}

export interface MatchSetupValidation {
  errors: FieldError[];
  warnings: FieldError[];
  isBlocking: boolean;
}

export function validateMatchSetup(input: MatchSetupInput): MatchSetupValidation {
  const errors: FieldError[] = [];
  const warnings: FieldError[] = [];

  if (!input.teamName.trim()) {
    errors.push({ field: 'teamName', message: 'Team name is required.' });
  }
  if (!input.opponentName.trim()) {
    errors.push({ field: 'opponentName', message: 'Opponent name is required.' });
  }
  if (!input.date) {
    errors.push({ field: 'date', message: 'Match date is required.' });
  } else if (Number.isNaN(new Date(input.date).getTime())) {
    errors.push({ field: 'date', message: 'Match date is invalid.' });
  }
  if (!MATCH_FORMATS.includes(input.format)) {
    errors.push({ field: 'format', message: 'Select a valid match format.' });
  }
  const formation = getFormationById(input.formationId);
  if (!formation) {
    errors.push({ field: 'formationId', message: 'Select a valid formation.' });
  } else if (formation.format !== input.format) {
    errors.push({ field: 'formationId', message: 'Formation does not match the selected format.' });
  }
  if (!Number.isFinite(input.halfLengthMinutes) || input.halfLengthMinutes <= 0) {
    errors.push({ field: 'halfLengthMinutes', message: 'Half length must be a positive number of minutes.' });
  }
  if (input.numberOfHalves !== 1 && input.numberOfHalves !== 2) {
    errors.push({ field: 'numberOfHalves', message: 'Number of halves must be 1 or 2.' });
  }

  // --- Assignment integrity checks ---
  const fieldEntries = Object.entries(input.assignments).filter(
    ([positionId, playerId]) => positionId !== 'BENCH' && !!playerId,
  );

  const maxOnField = MATCH_FORMAT_PLAYER_COUNT[input.format] ?? Infinity;
  if (fieldEntries.length > maxOnField) {
    errors.push({
      field: 'assignments',
      message: `Too many players assigned to the field: ${fieldEntries.length} assigned, but ${input.format} allows ${maxOnField}.`,
    });
  }

  const seenPositions = new Set<string>();
  for (const [positionId] of fieldEntries) {
    if (seenPositions.has(positionId)) {
      errors.push({
        field: 'assignments',
        message: `Position "${positionId}" has more than one player assigned.`,
      });
    }
    seenPositions.add(positionId);
  }

  const playerPositionCount = new Map<string, number>();
  for (const [, playerId] of fieldEntries) {
    playerPositionCount.set(playerId, (playerPositionCount.get(playerId) ?? 0) + 1);
  }
  for (const [playerId, count] of playerPositionCount) {
    if (count > 1) {
      errors.push({
        field: 'assignments',
        message: `A player is assigned to multiple positions (player ID ${playerId}).`,
      });
    }
  }

  if (fieldEntries.length < maxOnField && fieldEntries.length > 0) {
    warnings.push({
      field: 'assignments',
      message: `Only ${fieldEntries.length} of ${maxOnField} field positions are filled. The match can still start, but the team will be short-handed.`,
    });
  }
  if (fieldEntries.length === 0) {
    warnings.push({
      field: 'assignments',
      message: 'No players are assigned to the field yet.',
    });
  }

  return { errors, warnings, isBlocking: errors.length > 0 };
}

// ---------------------------------------------------------------------------
// Sanitizers used when loading persisted data (defensive against corruption)
// ---------------------------------------------------------------------------

export function sanitizeThresholds(raw: unknown): ThresholdSettings {
  const result: ThresholdSettings = { ...DEFAULT_THRESHOLDS };
  if (raw && typeof raw === 'object') {
    for (const group of POSITION_GROUPS) {
      const entry = (raw as Record<string, unknown>)[group];
      if (entry && typeof entry === 'object') {
        const enabled = (entry as { enabled?: unknown }).enabled;
        const minutes = (entry as { minutes?: unknown }).minutes;
        result[group] = {
          enabled: typeof enabled === 'boolean' ? enabled : DEFAULT_THRESHOLDS[group].enabled,
          minutes:
            typeof minutes === 'number' && minutes >= 1 && minutes <= 30
              ? minutes
              : DEFAULT_THRESHOLDS[group].minutes,
        };
      }
    }
  }
  return result;
}

export function sanitizeMatchSettings(raw: unknown, fallbackFormat: MatchFormat = '7v7'): MatchSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<MatchSettings>;
  const format = MATCH_FORMATS.includes(obj.format as MatchFormat) ? (obj.format as MatchFormat) : fallbackFormat;
  const formation = obj.formationId && getFormationById(obj.formationId);
  return {
    format,
    formationId: formation ? obj.formationId! : getDefaultFormationForFormat(format).id,
    halfLengthMinutes:
      typeof obj.halfLengthMinutes === 'number' && obj.halfLengthMinutes > 0 ? obj.halfLengthMinutes : 25,
    numberOfHalves: obj.numberOfHalves === 1 ? 1 : 2,
    thresholds: sanitizeThresholds(obj.thresholds),
    goalkeeperRotationEnabled: Boolean(obj.goalkeeperRotationEnabled),
    alertSoundEnabled: Boolean(obj.alertSoundEnabled),
  };
}

export function sanitizeAppSettings(raw: unknown): AppSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppSettings>;
  return {
    theme: obj.theme === 'dark' ? 'dark' : 'light',
    alertSoundEnabled: Boolean(obj.alertSoundEnabled),
    reducedMotion: Boolean(obj.reducedMotion),
    fieldLocked: Boolean(obj.fieldLocked),
  };
}

export function isValidPlayerRecord(raw: unknown): raw is Player {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Partial<Player>;
  return (
    typeof p.id === 'string' &&
    typeof p.teamId === 'string' &&
    typeof p.name === 'string' &&
    (p.jerseyNumber === undefined || typeof p.jerseyNumber === 'number') &&
    typeof p.preferredGroup === 'string' &&
    POSITION_GROUPS.includes(p.preferredGroup as PositionGroup) &&
    (p.availability === 'active' || p.availability === 'unavailable')
  );
}

export function mergeAppSettingsWithDefaults(raw: unknown): AppSettings {
  return { ...DEFAULT_APP_SETTINGS, ...sanitizeAppSettings(raw) };
}
