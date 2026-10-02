import { createId } from '../lib/id';
import { makeRoute } from './routes';
import type { Player } from '../types';
import { comparePlayersByJersey } from '../lib/playerSort';
import type { DriveEntry, FootballFormation, FootballPlay, PlayTemplate } from './types';

/** Fill empty slots, retaining the coach's existing choices and role designations. */
export function autofillFromRoster<T extends FootballFormation>(formation: T, roster: Player[]): T {
  const assigned = new Set(formation.players.map((slot) => slot.rosterPlayerId).filter(Boolean));
  const available = roster
    .filter((player) => player.teamId === formation.teamId && player.availability === 'active' && !assigned.has(player.id))
    .sort(comparePlayersByJersey);
  let next = 0;
  return {
    ...formation,
    players: formation.players.map((slot) => {
      if (slot.rosterPlayerId || next >= available.length) return slot;
      return { ...slot, rosterPlayerId: available[next++].id };
    }),
  };
}

export function newFormation(teamId: string): FootballFormation {
  const positions = [
    { x: 50, y: 85 },
    { x: 50, y: 70 },
    { x: 12, y: 70 },
    { x: 29, y: 73 },
    { x: 71, y: 73 },
    { x: 88, y: 70 },
    { x: 61, y: 82 },
  ];
  const players = positions.map((position, i) => ({
    id: createId(),
    label: ['QB', 'C', 'X', 'Y', 'Z', 'W', 'B'][i],
    position,
    route: makeRoute('stay'),
  }));
  return {
    id: createId(),
    teamId,
    name: 'Spread 7',
    side: 'offense',
    players,
    quarterbackId: players[0].id,
    snapperId: players[1].id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
export function playFromFormation(formation: FootballFormation): FootballPlay {
  const copy = structuredClone(formation);
  return {
    ...copy,
    id: createId(),
    name: 'New play',
    formationId: formation.id,
    schemaVersion: 1,
    description: '',
    tags: [],
    drawings: [],
    ballActions: [
      {
        id: createId(),
        type: 'snap',
        fromPlayerId: copy.snapperId,
        toPlayerId: copy.quarterbackId,
        order: 0,
        fake: false,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
export function instantiateTemplate(template: PlayTemplate, teamId: string): FootballPlay {
  const copy = structuredClone(template);
  const ids = new Map(copy.players.map((p) => [p.id, createId()]));
  return {
    ...copy,
    id: createId(),
    teamId,
    side: 'offense',
    schemaVersion: 1,
    players: copy.players.map((p) => ({ ...p, id: ids.get(p.id)! })),
    quarterbackId: ids.get(copy.quarterbackId)!,
    snapperId: ids.get(copy.snapperId)!,
    ballActions: copy.ballActions.map((a) => ({
      ...a,
      id: createId(),
      fromPlayerId: ids.get(a.fromPlayerId)!,
      toPlayerId: ids.get(a.toPlayerId)!,
    })),
    drawings: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
export function duplicatePlay(play: FootballPlay): FootballPlay {
  return {
    ...structuredClone(play),
    id: createId(),
    name: `${play.name} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
export function moveDriveEntry(entries: DriveEntry[], from: number, to: number): DriveEntry[] {
  if (from < 0 || to < 0 || from >= entries.length || to >= entries.length) return entries;
  const copy = [...entries];
  const [entry] = copy.splice(from, 1);
  copy.splice(to, 0, entry);
  return copy;
}
