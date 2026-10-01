import type { Drawing } from '../drawing/types';
import { ROUTE_LABELS } from './routes';
import type {
  DrivePlan,
  FootballFormation,
  FootballPlay,
  FootballWhiteboard,
  Point,
} from './types';

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
export function isPoint(value: unknown): value is Point {
  return record(value) && finite(value.x) && finite(value.y);
}
export function isDrawing(value: unknown): value is Drawing {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    ['pen', 'line', 'arrow'].includes(String(value.tool)) &&
    typeof value.color === 'string' &&
    finite(value.width) &&
    value.width > 0 &&
    Array.isArray(value.points) &&
    value.points.every(isPoint)
  );
}
export function formationErrors(value: unknown): string[] {
  if (!record(value)) return ['Invalid formation.'];
  const errors: string[] = [];
  if (
    typeof value.id !== 'string' ||
    typeof value.teamId !== 'string' ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.side !== 'offense' ||
    !finite(value.createdAt) ||
    !finite(value.updatedAt)
  )
    errors.push('Formation needs a name, team, and valid metadata.');
  if (!Array.isArray(value.players) || value.players.length !== 7)
    return [...errors, 'An offensive formation must have exactly seven players.'];
  const ids = new Set<string>();
  const rosterIds = new Set<string>();
  for (const p of value.players) {
    if (
      !record(p) ||
      typeof p.id !== 'string' ||
      typeof p.label !== 'string' ||
      !p.label.trim() ||
      !isPoint(p.position) ||
      p.position.x < 0 ||
      p.position.x > 100 ||
      p.position.y < 0 ||
      p.position.y > 100 ||
      !record(p.route) ||
      !Object.prototype.hasOwnProperty.call(ROUTE_LABELS, String(p.route.type)) ||
      !Array.isArray(p.route.points) ||
      !p.route.points.every(isPoint) ||
      !finite(p.route.depth) ||
      p.route.depth < 3 ||
      p.route.depth > 55 ||
      (p.route.direction !== -1 && p.route.direction !== 1) ||
      (p.motion !== undefined && (!Array.isArray(p.motion) || !p.motion.every(isPoint)))
    ) {
      errors.push('Player assignments or route geometry are invalid.');
      continue;
    }
    if (ids.has(p.id)) errors.push('Player slot IDs must be unique.');
    ids.add(p.id);
    if (p.rosterPlayerId !== undefined) {
      if (typeof p.rosterPlayerId !== 'string' || rosterIds.has(p.rosterPlayerId))
        errors.push('A roster player can occupy only one slot.');
      else rosterIds.add(p.rosterPlayerId);
    }
  }
  if (typeof value.quarterbackId !== 'string' || !ids.has(value.quarterbackId))
    errors.push('Designate exactly one quarterback.');
  if (
    typeof value.snapperId !== 'string' ||
    !ids.has(value.snapperId) ||
    value.snapperId === value.quarterbackId
  )
    errors.push('Designate a snapper separate from the quarterback.');
  return errors;
}
export function isFormation(value: unknown): value is FootballFormation {
  return formationErrors(value).length === 0;
}
export function playErrors(value: unknown): string[] {
  const errors = formationErrors(value);
  if (!record(value)) return errors;
  if (
    value.schemaVersion !== 1 ||
    typeof value.description !== 'string' ||
    !Array.isArray(value.tags) ||
    !value.tags.every((t) => typeof t === 'string') ||
    !Array.isArray(value.drawings) ||
    !value.drawings.every(isDrawing)
  )
    errors.push('Play metadata or drawings are invalid.');
  const ids = new Set(
    Array.isArray(value.players) ? value.players.map((p) => (record(p) ? p.id : undefined)) : [],
  );
  if (!Array.isArray(value.ballActions)) return [...errors, 'Ball actions are required.'];
  const actionIds = new Set<string>();
  for (const a of value.ballActions) {
    if (
      !record(a) ||
      typeof a.id !== 'string' ||
      actionIds.has(a.id) ||
      !['snap', 'pass', 'handoff', 'pitch'].includes(String(a.type)) ||
      !ids.has(a.fromPlayerId) ||
      !ids.has(a.toPlayerId) ||
      a.fromPlayerId === a.toPlayerId ||
      !finite(a.order) ||
      a.order < 0 ||
      !Number.isInteger(a.order) ||
      typeof a.fake !== 'boolean' ||
      (a.target !== undefined && !isPoint(a.target))
    )
      errors.push('Ball actions need distinct players, valid geometry, and an ordered beat.');
    else actionIds.add(a.id);
    if (
      record(a) &&
      a.type === 'snap' &&
      (a.fromPlayerId !== value.snapperId || a.toPlayerId !== value.quarterbackId || a.order !== 0)
    )
      errors.push('First action must snap from the designated snapper to the quarterback.');
  }
  if (
    value.ballActions.filter((a) => record(a) && a.type === 'snap' && a.fake === false).length !== 1
  )
    errors.push('Include exactly one snap.');
  return errors;
}
export function isPlay(value: unknown): value is FootballPlay {
  return playErrors(value).length === 0;
}
export function isDrive(value: unknown): value is DrivePlan {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    typeof value.teamId !== 'string' ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    !finite(value.createdAt) ||
    !finite(value.updatedAt) ||
    !Array.isArray(value.entries)
  )
    return false;
  const ids = new Set<string>();
  return value.entries.every((e) => {
    if (!record(e) || typeof e.id !== 'string' || typeof e.playId !== 'string' || ids.has(e.id))
      return false;
    ids.add(e.id);
    return true;
  });
}
export function isWhiteboard(value: unknown): value is FootballWhiteboard {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    typeof value.teamId === 'string' &&
    value.id === value.teamId &&
    finite(value.updatedAt) &&
    Array.isArray(value.drawings) &&
    value.drawings.every(isDrawing)
  );
}
