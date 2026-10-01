import { describe, expect, it } from 'vitest';
import {
  duplicatePlay,
  instantiateTemplate,
  moveDriveEntry,
  newFormation,
  playFromFormation,
} from './domain';
import { flipRoute, makeRoute, resizeRoute, rotateRoute, routePoints } from './routes';
import { PLAY_TEMPLATES } from './templates';
import { formationErrors, playErrors } from './validation';
import { nextDrawingPoints } from '../drawing/geometry';

describe('7v7 formations and play snapshots', () => {
  it('allows unusual labels and a releasing snapper without enforcing NFL positions', () => {
    const f = newFormation('flag');
    f.players.forEach((p) => {
      p.label = 'R';
      p.route = makeRoute('go');
    });
    expect(formationErrors(f)).toEqual([]);
    expect(playErrors(playFromFormation(f))).toEqual([]);
  });
  it('rejects wrong counts, missing roles, duplicate slots, duplicate roster players, and bad coordinates', () => {
    const f = newFormation('flag');
    expect(formationErrors({ ...f, players: f.players.slice(1) })).not.toHaveLength(0);
    expect(formationErrors({ ...f, snapperId: f.quarterbackId })).not.toHaveLength(0);
    expect(formationErrors({ ...f, quarterbackId: 'missing' })).not.toHaveLength(0);
    f.players[1].id = f.players[0].id;
    expect(formationErrors(f)).not.toHaveLength(0);
    const g = newFormation('flag');
    g.players[2].rosterPlayerId = 'roster';
    g.players[3].rosterPlayerId = 'roster';
    expect(formationErrors(g)).toContain('A roster player can occupy only one slot.');
    g.players[2].position.x = Infinity;
    expect(formationErrors(g)).toContain('Player assignments or route geometry are invalid.');
  });
  it('takes an independent formation snapshot and duplicates nested geometry', () => {
    const f = newFormation('flag');
    const play = playFromFormation(f);
    f.players[2].position.x = 1;
    expect(play.players[2].position.x).toBe(12);
    play.players[2].route = makeRoute('post');
    const copy = duplicatePlay(play);
    copy.players[2].route.points[0].x = 90;
    expect(play.players[2].route.points[0].x).toBe(0);
    expect(copy.id).not.toBe(play.id);
  });
  it('rejects dangling action references, missing snaps, and malformed drawings', () => {
    const play = playFromFormation(newFormation('flag'));
    expect(playErrors({ ...play, ballActions: [] })).toContain('Include exactly one snap.');
    play.ballActions[0].fromPlayerId = 'missing';
    expect(playErrors(play)).not.toHaveLength(0);
    expect(
      playErrors({ ...play, drawings: [{ tool: 'pen', points: 'invalid' }] }),
    ).not.toHaveLength(0);
  });
});
describe('editable route geometry', () => {
  it('distinguishes outside breaks from inside breaks before mirroring', () => {
    expect(makeRoute('out').points[1].x).toBeLessThan(0);
    expect(makeRoute('dig').points[1].x).toBeGreaterThan(0);
    expect(makeRoute('corner').points[1].x).toBeLessThan(0);
    expect(makeRoute('post').points[1].x).toBeGreaterThan(0);
  });
  it('flips geometry and direction without mutating the source, and flipping twice restores it', () => {
    const route = makeRoute('wheel', 30);
    const flipped = flipRoute(route);
    expect(flipped.points[0].x).toBe(-route.points[0].x);
    expect(flipped.direction).toBe(-1);
    expect(flipRoute(flipped)).toEqual(route);
    expect(route.direction).toBe(1);
  });
  it('scales custom depth without discarding edited control points', () => {
    const route = {
      ...makeRoute('custom', 20),
      points: [
        { x: 9, y: -17 },
        { x: 13, y: -20 },
      ],
    };
    expect(resizeRoute(route, 40).points).toEqual([
      { x: 9, y: -34 },
      { x: 13, y: -40 },
    ]);
  });
  it('rotates routes and translates relative offsets when players move', () => {
    const route = rotateRoute(makeRoute('go', 20), 90);
    expect(route.points[0].x).toBeCloseTo(20);
    expect(route.points[0].y).toBeCloseTo(0);
    expect(routePoints({ x: 40, y: 80 }, [{ x: 10, y: -20 }])).toEqual([
      { x: 40, y: 80 },
      { x: 50, y: 60 },
    ]);
  });
  it('shares freehand and straight-line point handling across whiteboards', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(nextDrawingPoints('pen', points, { x: 2, y: 2 })).toHaveLength(3);
    expect(nextDrawingPoints('arrow', points, { x: 2, y: 2 })).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ]);
  });
});
describe('original editable starter concepts', () => {
  it.each(PLAY_TEMPLATES.map((t) => [t.name, t] as const))(
    '%s instantiates valid, independent 7v7 data',
    (_name, template) => {
      const a = instantiateTemplate(template, 'flag');
      const b = instantiateTemplate(template, 'flag');
      expect(playErrors(a)).toEqual([]);
      expect(a.players).toHaveLength(7);
      expect(a.players[0].id).not.toBe(b.players[0].id);
      expect(a.ballActions[0].fromPlayerId).toBe(a.snapperId);
      a.players[2].position.x = 2;
      expect(template.players[2].position.x).toBe(12);
      expect(b.players[2].position.x).toBe(12);
    },
  );
});
describe('drive ordering', () => {
  it('reorders repeated plays by entry identity and preserves the original sequence', () => {
    const entries = [
      { id: 'a', playId: 'mesh' },
      { id: 'b', playId: 'mesh' },
      { id: 'c', playId: 'flood' },
    ];
    expect(moveDriveEntry(entries, 0, 2).map((e) => e.id)).toEqual(['b', 'c', 'a']);
    expect(entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(moveDriveEntry(entries, -1, 1)).toEqual(entries);
  });
});
