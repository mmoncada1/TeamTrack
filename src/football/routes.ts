import type { FootballRoute, Point, RouteType } from './types';

export const ROUTE_LABELS: Record<RouteType, string> = {
  go: 'Go / Fly',
  slant: 'Slant',
  out: 'Out',
  dig: 'In / Dig',
  post: 'Post',
  corner: 'Corner',
  curl: 'Curl / Comeback',
  hitch: 'Hitch',
  flat: 'Flat',
  wheel: 'Wheel',
  drag: 'Drag',
  cross: 'Crossing route',
  seam: 'Seam',
  custom: 'Custom route',
  block: 'Block',
  stay: 'Stay / no route',
};
export function makeRoute(type: RouteType, depth = 25, direction: -1 | 1 = 1): FootballRoute {
  const d = Math.max(3, Math.min(55, depth));
  const geometry: Record<RouteType, Point[]> = {
    go: [{ x: 0, y: -d }],
    seam: [{ x: 0, y: -d }],
    slant: [
      { x: 0, y: -d * 0.2 },
      { x: d * 0.6, y: -d },
    ],
    out: [
      { x: 0, y: -d },
      { x: -8, y: -d },
    ],
    dig: [
      { x: 0, y: -d },
      { x: 20, y: -d },
    ],
    post: [
      { x: 0, y: -d * 0.55 },
      { x: 16, y: -d },
    ],
    corner: [
      { x: 0, y: -d * 0.55 },
      { x: -8, y: -d },
    ],
    curl: [
      { x: 0, y: -d },
      { x: 4, y: -d + 6 },
    ],
    hitch: [
      { x: 0, y: -d },
      { x: 0, y: -d + 3 },
    ],
    flat: [{ x: -8, y: -4 }],
    wheel: [
      { x: -8, y: -3 },
      { x: -9, y: -10 },
      { x: -9, y: -d },
    ],
    drag: [
      { x: 0, y: -5 },
      { x: d, y: -5 },
    ],
    cross: [
      { x: 0, y: -d * 0.3 },
      { x: 25, y: -d },
    ],
    custom: [],
    block: [{ x: 0, y: -4 }],
    stay: [],
  };
  return {
    type,
    depth: d,
    direction,
    points: geometry[type].map((p) => ({ x: p.x === 0 ? 0 : p.x * direction, y: p.y })),
  };
}
export function flipRoute(route: FootballRoute): FootballRoute {
  return {
    ...route,
    direction: route.direction === 1 ? -1 : 1,
    points: route.points.map((p) => ({ x: p.x === 0 ? 0 : -p.x, y: p.y })),
  };
}
/** Scale existing geometry, including custom edits, rather than resetting it. */
export function resizeRoute(route: FootballRoute, depth: number): FootballRoute {
  const next = Math.max(3, Math.min(55, depth));
  return {
    ...route,
    depth: next,
    points: route.points.map((p) => ({ x: p.x, y: (p.y * next) / route.depth })),
  };
}
export function rotateRoute(route: FootballRoute, degrees: number): FootballRoute {
  const radians = (degrees * Math.PI) / 180;
  return {
    ...route,
    points: route.points.map((p) => ({
      x: p.x * Math.cos(radians) - p.y * Math.sin(radians),
      y: p.x * Math.sin(radians) + p.y * Math.cos(radians),
    })),
  };
}
export function routePoints(position: Point, offsets: Point[]): Point[] {
  return [position, ...offsets.map((p) => ({ x: position.x + p.x, y: position.y + p.y }))];
}
export function clampPoint(p: Point): Point {
  return { x: Math.max(3, Math.min(97, p.x)), y: Math.max(3, Math.min(97, p.y)) };
}
