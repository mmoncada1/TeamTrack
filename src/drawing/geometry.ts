import type { Drawing, Point } from './types';

export function pointFromPointer(
  event: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
): Point {
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100)),
  };
}
export function pathData(points: Point[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
}
export function extendDrawing(drawing: Drawing, point: Point): Drawing {
  return { ...drawing, points: nextDrawingPoints(drawing.tool, drawing.points, point) };
}
/** Coordinates may be field units or normalized canvas units. */
export function nextDrawingPoints(tool: string, points: Point[], point: Point): Point[] {
  return tool === 'line' || tool === 'arrow' ? [points[0], point] : [...points, point];
}
