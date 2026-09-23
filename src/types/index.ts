/**
 * Core data model for TeamTrack.
 *
 * These types are intentionally plain data (no class instances) so they can
 * be stored in IndexedDB (via Dexie), serialized to JSON for import/export,
 * and used as the input/output of pure functions in `src/lib`.
 */

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};

export type MatchFormat = '7v7' | '9v9' | '11v11';

export const MATCH_FORMAT_PLAYER_COUNT: Record<MatchFormat, number> = {
  '7v7': 7,
  '9v9': 9,
  '11v11': 11,
};

export type PlayerAvailability = 'active' | 'unavailable';

/** Used by co-ed teams so the match can count girls currently on the field. */
export type PlayerGender = 'girl' | 'boy';

export const PLAYER_GENDER_LABELS: Record<PlayerGender, string> = {
  girl: 'Girl',
  boy: 'Boy',
};

/** A club or squad the coach manages. Rosters and matches belong to one team. */
export interface Team {
  id: string;
  name: string;
  /**
   * Co-ed leagues require a minimum number of girls on the field at once.
   * Missing means a single-gender team (existing teams before this option).
   */
  coed?: boolean;
  /** Required girls on the field. Only used when `coed` is true. */
  minGirlsOnField?: number;
  createdAt: number;
  updatedAt: number;
}

/** A player in the persistent roster (not tied to a single match). */
export interface Player {
  id: string;
  teamId: string;
  name: string;
  /** Optional — some rosters (e.g. very young teams) don't assign numbers. */
  jerseyNumber?: number;
  /** First selected position. Token color follows this. Kept so older saves still load. */
  preferredGroup: PositionGroup;
  /** Every position this player can play, in the order the coach chose. */
  preferredGroups?: PositionGroup[];
  /** Set for co-ed rosters. Omitted on older players until the coach chooses one. */
  gender?: PlayerGender;
  notes?: string;
  availability: PlayerAvailability;
  /** Foreign key into the `photos` table, if a profile picture was uploaded. */
  photoId?: string;
  createdAt: number;
  updatedAt: number;
}

/** A locally stored, compressed profile picture. */
export interface PlayerPhoto {
  id: string;
  playerId: string;
  /** Compressed image data, stored as a Blob in IndexedDB. */
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  createdAt: number;
}

/** A single position slot within a formation. */
export interface FormationPosition {
  id: string;
  label: string;
  group: PositionGroup;
  /** Percentage (0-100) from the left of the field. */
  x: number;
  /** Percentage (0-100) from the top of the field (0 = opponent's end). */
  y: number;
}

/** A named arrangement of positions for a given match format. */
export interface Formation {
  id: string;
  format: MatchFormat;
  name: string;
  /** Human readable shape, e.g. "2-3-1". Does not include the goalkeeper. */
  shape: string;
  positions: FormationPosition[];
}

export type SlotId = string | 'BENCH';

/** Configurable playing-time alert threshold for a position group. */
export interface ThresholdSetting {
  enabled: boolean;
  minutes: number;
}

export type ThresholdSettings = Record<PositionGroup, ThresholdSetting>;

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  GK: { enabled: false, minutes: 10 },
  DEF: { enabled: true, minutes: 5 },
  MID: { enabled: true, minutes: 4 },
  FWD: { enabled: true, minutes: 5 },
};

export interface MatchSettings {
  format: MatchFormat;
  formationId: string;
  /** Length of a single half, in minutes. */
  halfLengthMinutes: number;
  numberOfHalves: 1 | 2;
  thresholds: ThresholdSettings;
  goalkeeperRotationEnabled: boolean;
  alertSoundEnabled: boolean;
}

export type MatchStatus =
  | 'setup'
  | 'in_progress'
  | 'paused'
  | 'half_time'
  | 'ended';

/** A snapshot of where every player stood at one moment in time. */
export interface Assignment {
  [positionId: string]: string /* playerId */;
}

export type MatchEventType =
  | 'MATCH_STARTED'
  | 'MATCH_PAUSED'
  | 'MATCH_RESUMED'
  | 'HALF_TIME'
  | 'SECOND_HALF_STARTED'
  | 'FORMATION_CHANGED'
  | 'PLAYER_MOVED'
  | 'PLAYERS_SWAPPED'
  | 'SUBSTITUTION'
  | 'PLAYER_JOINED'
  | 'PLAYER_UNAVAILABLE'
  | 'PLAYER_AVAILABLE'
  | 'PLAYER_REMOVED'
  | 'GOAL'
  | 'CARD'
  | 'ALERT_DISMISSED'
  | 'MATCH_ENDED'
  | 'NOTE';

interface BaseMatchEvent {
  id: string;
  type: MatchEventType;
  /** Milliseconds elapsed on the match clock when this event occurred. */
  matchClockMs: number;
  /** Real wall-clock timestamp (ms since epoch) when this event occurred. */
  timestamp: number;
  note?: string;
  /** Player IDs involved, for quick filtering/search. */
  playerIds: string[];
}

export interface MatchStartedEvent extends BaseMatchEvent {
  type: 'MATCH_STARTED';
  formationId: string;
  assignments: Assignment;
  unavailablePlayerIds: string[];
}

export interface MatchPausedEvent extends BaseMatchEvent {
  type: 'MATCH_PAUSED';
}

export interface MatchResumedEvent extends BaseMatchEvent {
  type: 'MATCH_RESUMED';
}

export interface HalfTimeEvent extends BaseMatchEvent {
  type: 'HALF_TIME';
}

export interface SecondHalfStartedEvent extends BaseMatchEvent {
  type: 'SECOND_HALF_STARTED';
}

export interface FormationChangedEvent extends BaseMatchEvent {
  type: 'FORMATION_CHANGED';
  fromFormationId: string;
  toFormationId: string;
  newAssignments: Assignment;
  movedToBenchPlayerIds: string[];
  summary: string;
}

export interface PlayerMovedEvent extends BaseMatchEvent {
  type: 'PLAYER_MOVED';
  playerId: string;
  fromSlot: SlotId;
  toSlot: SlotId;
}

export interface PlayersSwappedEvent extends BaseMatchEvent {
  type: 'PLAYERS_SWAPPED';
  playerAId: string;
  positionAId: string;
  playerBId: string;
  positionBId: string;
}

export interface SubstitutionEvent extends BaseMatchEvent {
  type: 'SUBSTITUTION';
  playerInId: string;
  playerOutId: string;
  positionId: string;
}

/** A roster player joined this match after it started, on the bench. */
export interface PlayerJoinedEvent extends BaseMatchEvent {
  type: 'PLAYER_JOINED';
  playerId: string;
}

/** Left the field or bench at this moment (injured). Time already played is kept. */
export interface PlayerUnavailableEvent extends BaseMatchEvent {
  type: 'PLAYER_UNAVAILABLE';
  playerId: string;
  reason: 'injured';
}

/** Returned from injured/unavailable onto the bench. */
export interface PlayerAvailableEvent extends BaseMatchEvent {
  type: 'PLAYER_AVAILABLE';
  playerId: string;
}

/** Taken out of this match. Time already played is kept. */
export interface PlayerRemovedEvent extends BaseMatchEvent {
  type: 'PLAYER_REMOVED';
  playerId: string;
}

export interface GoalEvent extends BaseMatchEvent {
  type: 'GOAL';
  team: 'us' | 'opponent';
  isOwnGoal: boolean;
  scorerId?: string;
  assisterId?: string;
}

export type CardColor = 'yellow' | 'red';

/** A caution or a sending-off. A red card takes the player out for the rest of the match. */
export interface CardEvent extends BaseMatchEvent {
  type: 'CARD';
  playerId: string;
  color: CardColor;
  /** True when this red card came from a second yellow. */
  secondYellow?: boolean;
}

export interface AlertDismissedEvent extends BaseMatchEvent {
  type: 'ALERT_DISMISSED';
  alertId: string;
  playerId: string;
  action: 'dismiss' | 'snooze';
}

export interface MatchEndedEvent extends BaseMatchEvent {
  type: 'MATCH_ENDED';
}

export interface NoteEvent extends BaseMatchEvent {
  type: 'NOTE';
}

export type MatchEvent =
  | MatchStartedEvent
  | MatchPausedEvent
  | MatchResumedEvent
  | HalfTimeEvent
  | SecondHalfStartedEvent
  | FormationChangedEvent
  | PlayerMovedEvent
  | PlayersSwappedEvent
  | SubstitutionEvent
  | PlayerJoinedEvent
  | PlayerUnavailableEvent
  | PlayerAvailableEvent
  | PlayerRemovedEvent
  | GoalEvent
  | CardEvent
  | AlertDismissedEvent
  | MatchEndedEvent
  | NoteEvent;

export type AlertStatus = 'active' | 'snoozed' | 'dismissed' | 'resolved';

export interface Alert {
  id: string;
  playerId: string;
  positionGroup: PositionGroup;
  thresholdMinutes: number;
  /** Match clock ms at which the player's current stint began. */
  stintStartMs: number;
  /** Match clock ms at which the alert was first raised. */
  createdAtClockMs: number;
  status: AlertStatus;
  snoozeUntilClockMs?: number;
  recommendation?: {
    inPlayerId: string;
    explanation: string;
  };
}

/** One continuous span of time a player spent in a given status. */
export interface StatusInterval {
  status: 'field' | 'bench';
  positionId?: string;
  startMs: number;
  /** `null` means the interval is still open (ongoing). */
  endMs: number | null;
}

export interface Match {
  id: string;
  /** Team this match was created for. The roster comes from this team. */
  teamId: string;
  teamName: string;
  opponentName: string;
  date: string; // ISO date string, yyyy-mm-dd
  title?: string;
  settings: MatchSettings;
  /** Roster player IDs selected/available for this match. */
  rosterPlayerIds: string[];
  /** Player IDs explicitly marked unavailable for this specific match. */
  unavailablePlayerIds: string[];
  /** Assignments used before the match has started (setup screen only). */
  pendingAssignments: Assignment;
  pendingFormationId: string;
  /**
   * Append-only (but editable/deletable for corrections) log of everything
   * that happened. `status`, `currentHalf`, the match clock, score, and all
   * player statistics are DERIVED from this log by `deriveMatchState`
   * rather than stored redundantly, so undo/edit/delete always yields a
   * consistent result.
   */
  events: MatchEvent[];
  /** Transient alert state; not derivable from events, persisted for continuity across refresh. */
  activeAlerts: Alert[];
  createdAt: number;
  updatedAt: number;
}

/** Aggregated, derived state for a single player within a match. */
export interface PlayerRuntimeState {
  playerId: string;
  status: 'field' | 'bench' | 'unavailable';
  positionId: string | null;
  positionGroup: PositionGroup | null;
  intervals: StatusInterval[];
  currentStintStartMs: number | null;
  currentStintMs: number;
  totalFieldMs: number;
  totalBenchMs: number;
  subsIn: number;
  subsOut: number;
  lastSubTimeMs: number | null;
  goals: number;
  assists: number;
}

export interface PlayingTimeSummary extends PlayerRuntimeState {
  playerName: string;
  jerseyNumber?: number;
}

export interface DerivedMatchState {
  status: MatchStatus;
  currentHalf: 1 | 2;
  assignments: Assignment;
  formationId: string;
  playerStates: Record<string, PlayerRuntimeState>;
  /** Players currently in this match: kickoff roster, plus late additions, minus removals. */
  includedPlayerIds: string[];
  /** Subset of included players marked injured during the match. */
  injuredPlayerIds: string[];
  /** Players sent off with a red card. They cannot return. */
  sentOffPlayerIds: string[];
  teamScore: number;
  opponentScore: number;
  /** Cumulative time across both halves. Used for playing-time math. */
  matchClockMs: number;
  /**
   * Clock shown to the coach. Resets to 0:00 at half-time and counts the
   * current half only. Playing time still uses `matchClockMs`.
   */
  displayClockMs: number;
  /** Whether the clock is actively running right now (for UI ticking). */
  isClockRunning: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  alertSoundEnabled: boolean;
  reducedMotion: boolean;
  fieldLocked: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  alertSoundEnabled: false,
  reducedMotion: false,
  fieldLocked: false,
};

/** Shape of a full JSON export/backup of the app's local data. */
export interface AppBackup {
  version: number;
  exportedAt: number;
  teams: Team[];
  players: Player[];
  matches: Match[];
  /** Profile pictures, ready to store (blob already reconstructed from the JSON data URL). */
  photos: PlayerPhoto[];
  settings: AppSettings;
}
