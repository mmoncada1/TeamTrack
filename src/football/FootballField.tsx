import { useId, useRef, useState } from 'react';
import type { FootballPlay, FootballPlayerAssignment, Point } from './types';
import type { Drawing, DrawingTool } from '../drawing/types';
import { DrawingLayer } from '../drawing/DrawingLayer';
import { extendDrawing, pathData, pointFromPointer } from '../drawing/geometry';
import { clampPoint, routePoints } from './routes';
import { createId } from '../lib/id';
import type { Player } from '../types';
import { FootballPlayerToken } from './FootballPlayerToken';

interface Props {
  roster?: Player[];
  players?: FootballPlayerAssignment[];
  quarterbackId?: string;
  snapperId?: string;
  ballActions?: FootballPlay['ballActions'];
  drawings?: Drawing[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onPlayers?: (players: FootballPlayerAssignment[]) => void;
  onDrawings?: (drawings: Drawing[]) => void;
  onGestureStart?: () => void;
  tool?: DrawingTool;
  ink?: string;
  editPath?: 'route' | 'motion';
  preview?: boolean;
  onTarget?: (point: Point) => void;
}
type Drag =
  | { kind: 'player'; id: string; offset: Point }
  | { kind: 'point'; id: string; index: number; motion: boolean };
export function FootballField({
  roster = [],
  players = [],
  quarterbackId,
  snapperId,
  ballActions = [],
  drawings = [],
  selectedId,
  onSelect,
  onPlayers,
  onDrawings,
  onGestureStart,
  tool = 'select',
  ink = '#facc15',
  editPath,
  preview,
  onTarget,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const stroke = useRef<Drawing | null>(null);
  const [pending, setPending] = useState<Drawing | null>(null);
  const id = useId().replace(/:/g, '');
  const arrow = `arrow-${id}`;
  const point = (event: React.PointerEvent) =>
    pointFromPointer(event, svg.current!.getBoundingClientRect());
  function capture(event: React.PointerEvent) {
    event.preventDefault();
    svg.current?.setPointerCapture?.(event.pointerId);
  }
  function startPlayer(event: React.PointerEvent, p: FootballPlayerAssignment) {
    if (preview || tool !== 'select' || !onPlayers) return;
    event.stopPropagation();
    onSelect?.(p.id);
    onGestureStart?.();
    capture(event);
    const at = point(event);
    drag.current = {
      kind: 'player',
      id: p.id,
      offset: { x: p.position.x - at.x, y: p.position.y - at.y },
    };
  }
  function down(event: React.PointerEvent<SVGSVGElement>) {
    if (preview) return;
    const at = point(event);
    if (onTarget) {
      onTarget(at);
      return;
    }
    if (tool === 'select' && editPath && selectedId && onPlayers) {
      onGestureStart?.();
      onPlayers(
        players.map((p) =>
          p.id !== selectedId
            ? p
            : editPath === 'motion'
              ? {
                  ...p,
                  motion: [...(p.motion ?? []), { x: at.x - p.position.x, y: at.y - p.position.y }],
                }
              : {
                  ...p,
                  route: {
                    ...p.route,
                    type: 'custom',
                    points: [...p.route.points, { x: at.x - p.position.x, y: at.y - p.position.y }],
                  },
                },
        ),
      );
    } else if (tool === 'pen' || tool === 'line' || tool === 'arrow') {
      capture(event);
      onGestureStart?.();
      stroke.current = { id: createId(), tool, color: ink, width: 0.7, points: [at, at] };
      setPending(stroke.current);
    }
  }
  function move(event: React.PointerEvent<SVGSVGElement>) {
    const at = point(event);
    if (stroke.current) {
      stroke.current = extendDrawing(stroke.current, at);
      setPending(stroke.current);
    }
    const active = drag.current;
    if (!active || !onPlayers) return;
    onPlayers(
      players.map((p) => {
        if (p.id !== active.id) return p;
        if (active.kind === 'player')
          return {
            ...p,
            position: clampPoint({ x: at.x + active.offset.x, y: at.y + active.offset.y }),
          };
        const points = [...(active.motion ? (p.motion ?? []) : p.route.points)];
        points[active.index] = { x: at.x - p.position.x, y: at.y - p.position.y };
        return active.motion ? { ...p, motion: points } : { ...p, route: { ...p.route, points } };
      }),
    );
  }
  function up() {
    if (stroke.current) onDrawings?.([...drawings, stroke.current]);
    drag.current = null;
    stroke.current = null;
    setPending(null);
  }
  return (
    <svg
      ref={svg}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role={preview ? 'img' : 'group'}
      aria-label="7v7 football field and play art"
      className="aspect-square w-full touch-none select-none rounded-xl bg-emerald-900 shadow-inner"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <defs>
        <marker
          id={arrow}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      <rect width="100" height="100" fill="#236443" />
      <rect x="3" y="3" width="94" height="10" fill="#174b35" />
      <text x="50" y="10" fill="white" fontSize="3" textAnchor="middle">
        END ZONE · OFFENSE ↑
      </text>
      <rect x="3" y="3" width="94" height="94" stroke="white" strokeWidth=".5" fill="none" />
      {[20, 30, 40, 50, 60, 70, 80, 90].map((y, i) => (
        <g key={y} stroke="white" opacity=".45">
          <line x1="3" x2="97" y1={y} y2={y} strokeWidth=".3" />
          <text x="5" y={y - 1} fontSize="2.5" fill="white" stroke="none">
            {(7 - i) * 5}
          </text>
          <line x1="35" x2="35" y1={y - 1} y2={y + 1} />
          <line x1="65" x2="65" y1={y - 1} y2={y + 1} />
        </g>
      ))}
      <line x1="3" x2="97" y1="70" y2="70" stroke="#60a5fa" strokeWidth=".7" />
      <text x="95" y="68" textAnchor="end" fill="#bfdbfe" fontSize="2.5">
        LINE OF SCRIMMAGE
      </text>
      {players.map((p) => (
        <g key={p.id}>
          {p.route.points.length > 0 && (
            <path
              d={pathData(routePoints(p.position, p.route.points))}
              fill="none"
              stroke={p.id === selectedId ? '#facc15' : '#fff'}
              strokeWidth=".7"
              markerEnd={p.route.type === 'block' ? undefined : `url(#${arrow})`}
            />
          )}
          {p.route.type === 'block' &&
            p.route.points.length > 0 &&
            (() => {
              const points = routePoints(p.position, p.route.points);
              const end = points[points.length - 1];
              return (
                <line
                  x1={end.x - 2}
                  x2={end.x + 2}
                  y1={end.y}
                  y2={end.y}
                  stroke="white"
                  strokeWidth="1"
                />
              );
            })()}
          {p.motion && (
            <path
              d={pathData(routePoints(p.position, p.motion))}
              fill="none"
              stroke="#c084fc"
              strokeDasharray="1.5 1"
              strokeWidth=".7"
              markerEnd={`url(#${arrow})`}
            />
          )}
          <g
            role={preview ? undefined : 'button'}
            tabIndex={preview ? undefined : 0}
            aria-label={`Select ${p.label}${p.rosterPlayerId ? `, ${roster.find((player) => player.id === p.rosterPlayerId)?.name ?? 'assigned player'}` : ''}${p.id === quarterbackId ? ', quarterback' : ''}${p.id === snapperId ? ', snapper' : ''}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(p.id);
              }
              if (
                tool === 'select' &&
                onPlayers &&
                ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
              ) {
                e.preventDefault();
                onGestureStart?.();
                onPlayers(
                  players.map((slot) =>
                    slot.id === p.id
                      ? {
                          ...slot,
                          position: clampPoint({
                            x:
                              slot.position.x +
                              (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0),
                            y:
                              slot.position.y +
                              (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0),
                          }),
                        }
                      : slot,
                  ),
                );
              }
            }}
            onPointerDown={(e) => startPlayer(e, p)}
            style={{ cursor: preview ? 'default' : 'grab' }}
          >
            <FootballPlayerToken
              slot={p}
              player={roster.find((player) => player.id === p.rosterPlayerId)}
              quarterback={p.id === quarterbackId}
              snapper={p.id === snapperId}
              selected={selectedId === p.id}
            />
            <circle
              cx={p.position.x}
              cy={p.position.y}
              r="4"
              fill="transparent"
              pointerEvents="all"
              data-player-handle={p.id}
            />
          </g>
          {!preview &&
            tool === 'select' &&
            p.id === selectedId &&
            (editPath === 'motion' ? (p.motion ?? []) : p.route.points).map((offset, index) => (
              <circle
                key={index}
                cx={p.position.x + offset.x}
                cy={p.position.y + offset.y}
                r="1.25"
                fill={editPath === 'motion' ? '#c084fc' : '#facc15'}
                stroke="#0f172a"
                strokeWidth=".4"
                style={{ cursor: 'move' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onGestureStart?.();
                  capture(e);
                  drag.current = { kind: 'point', id: p.id, index, motion: editPath === 'motion' };
                }}
              />
            ))}
        </g>
      ))}
      {ballActions.map((a) => {
        const from = players.find((p) => p.id === a.fromPlayerId);
        const to = players.find((p) => p.id === a.toPlayerId);
        if (!from || !to) return null;
        const points = routePoints(to.position, to.route.points);
        const end = a.target ?? (a.type === 'snap' ? to.position : points[points.length - 1]);
        const color =
          a.type === 'snap'
            ? '#93c5fd'
            : a.type === 'pass'
              ? '#fb923c'
              : a.type === 'handoff'
                ? '#f472b6'
                : '#22d3ee';
        return (
          <g key={a.id} pointerEvents="none">
            <line
              x1={from.position.x}
              y1={from.position.y}
              x2={end.x}
              y2={end.y}
              stroke={color}
              strokeWidth=".7"
              strokeDasharray={
                a.fake ? '1 2' : a.type === 'pass' || a.type === 'pitch' ? '2 1' : undefined
              }
              markerEnd={`url(#${arrow})`}
            />
            <text
              x={(from.position.x + end.x) / 2 + 1}
              y={(from.position.y + end.y) / 2}
              fontSize="2.4"
              fill={color}
            >
              {a.order + 1}: {a.fake ? 'fake ' : ''}
              {a.type}
            </text>
          </g>
        );
      })}
      <DrawingLayer
        drawings={pending ? [...drawings, pending] : drawings}
        arrowId={arrow}
        erase={
          tool === 'erase' && onDrawings
            ? (drawingId) => {
                onGestureStart?.();
                onDrawings(drawings.filter((d) => d.id !== drawingId));
              }
            : undefined
        }
      />
    </svg>
  );
}
