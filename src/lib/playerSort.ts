interface JerseySortable {
  jerseyNumber?: number;
  name: string;
}

/** Sort by jersey number ascending; players without a number sort last, then alphabetically. */
export function comparePlayersByJersey(a: JerseySortable, b: JerseySortable): number {
  if (a.jerseyNumber == null && b.jerseyNumber == null) return a.name.localeCompare(b.name);
  if (a.jerseyNumber == null) return 1;
  if (b.jerseyNumber == null) return -1;
  return a.jerseyNumber - b.jerseyNumber;
}

interface JerseySortableSummary {
  jerseyNumber?: number;
  playerName: string;
}

/** Same ordering as `comparePlayersByJersey`, for records that use `playerName` instead of `name`. */
export function compareSummariesByJersey(a: JerseySortableSummary, b: JerseySortableSummary): number {
  return comparePlayersByJersey({ jerseyNumber: a.jerseyNumber, name: a.playerName }, { jerseyNumber: b.jerseyNumber, name: b.playerName });
}

/** Render a player's jersey number for display, or a neutral placeholder when unset. */
export function jerseyLabel(jerseyNumber: number | undefined): string {
  return jerseyNumber != null ? `#${jerseyNumber}` : '—';
}
