import type { Drawing, Point } from '../drawing/types';

/** Field coordinates: x across 0..100, y down 0..100; offense travels up. */
export type { Point } from '../drawing/types';
export type RouteType =
  | 'go'
  | 'slant'
  | 'out'
  | 'dig'
  | 'post'
  | 'corner'
  | 'curl'
  | 'hitch'
  | 'flat'
  | 'wheel'
  | 'drag'
  | 'cross'
  | 'seam'
  | 'custom'
  | 'block'
  | 'stay';
/** Points are offsets from the player, preserving geometry when a player moves. */
export interface FootballRoute {
  type: RouteType;
  points: Point[];
  depth: number;
  direction: -1 | 1;
}
export interface FootballPlayerAssignment {
  id: string;
  label: string;
  rosterPlayerId?: string;
  position: Point;
  route: FootballRoute;
  /** Pre-snap path, offsets from starting position. */
  motion?: Point[];
}
export interface FootballFormation {
  id: string;
  teamId: string;
  name: string;
  side: 'offense';
  players: FootballPlayerAssignment[];
  quarterbackId: string;
  snapperId: string;
  createdAt: number;
  updatedAt: number;
}
export type BallActionType = 'snap' | 'pass' | 'handoff' | 'pitch';
export interface BallAction {
  id: string;
  type: BallActionType;
  fromPlayerId: string;
  toPlayerId: string;
  /** Ordered beats leave room for timed animation and complex sequences. */
  order: number;
  fake: boolean;
  /** Optional absolute target; otherwise use the recipient's route endpoint. */
  target?: Point;
}
export interface FootballPlay extends FootballFormation {
  schemaVersion: 1;
  description: string;
  formationId?: string;
  tags: string[];
  ballActions: BallAction[];
  drawings: Drawing[];
}
export interface PlayTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  players: FootballPlayerAssignment[];
  quarterbackId: string;
  snapperId: string;
  ballActions: BallAction[];
}
export interface DriveEntry {
  id: string;
  playId: string;
}
export interface DrivePlan {
  id: string;
  teamId: string;
  name: string;
  entries: DriveEntry[];
  createdAt: number;
  updatedAt: number;
}
export interface FootballWhiteboard {
  id: string;
  teamId: string;
  drawings: Drawing[];
  updatedAt: number;
}
export interface FootballData {
  footballFormations: FootballFormation[];
  footballPlays: FootballPlay[];
  drivePlans: DrivePlan[];
  footballWhiteboards: FootballWhiteboard[];
}
