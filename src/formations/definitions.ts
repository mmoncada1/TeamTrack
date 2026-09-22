import type { Formation, FormationPosition, MatchFormat, PositionGroup } from '../types';

/**
 * All coordinates are percentages of the field. y=0 is the opponent's goal
 * line (attacking end) and y=100 is the team's own goal line (defensive
 * end), so formations read naturally top-to-bottom as GK -> DEF -> MID -> FWD
 * when the field is displayed with the team defending the bottom.
 */

function pos(
  id: string,
  label: string,
  group: PositionGroup,
  x: number,
  y: number,
): FormationPosition {
  return { id, label, group, x, y };
}

const GK = pos('gk', 'Goalkeeper', 'GK', 50, 94);

function formation(
  format: MatchFormat,
  id: string,
  shape: string,
  positions: FormationPosition[],
): Formation {
  return { id, format, name: shape, shape, positions: [GK, ...positions] };
}

// ---------------------------------------------------------------------------
// 7v7 formations (6 outfield players + GK)
// ---------------------------------------------------------------------------

const F_7_2_3_1 = formation('7v7', '7v7-2-3-1', '2-3-1', [
  pos('def-l', 'Left Back', 'DEF', 25, 74),
  pos('def-r', 'Right Back', 'DEF', 75, 74),
  pos('mid-l', 'Left Midfield', 'MID', 18, 48),
  pos('mid-c', 'Center Midfield', 'MID', 50, 48),
  pos('mid-r', 'Right Midfield', 'MID', 82, 48),
  pos('fwd-c', 'Striker', 'FWD', 50, 20),
]);

const F_7_2_2_2 = formation('7v7', '7v7-2-2-2', '2-2-2', [
  pos('def-l', 'Left Back', 'DEF', 25, 74),
  pos('def-r', 'Right Back', 'DEF', 75, 74),
  pos('mid-l', 'Left Midfield', 'MID', 25, 48),
  pos('mid-r', 'Right Midfield', 'MID', 75, 48),
  pos('fwd-l', 'Left Forward', 'FWD', 30, 20),
  pos('fwd-r', 'Right Forward', 'FWD', 70, 20),
]);

const F_7_3_2_1 = formation('7v7', '7v7-3-2-1', '3-2-1', [
  pos('def-l', 'Left Back', 'DEF', 18, 76),
  pos('def-c', 'Center Back', 'DEF', 50, 78),
  pos('def-r', 'Right Back', 'DEF', 82, 76),
  pos('mid-l', 'Left Midfield', 'MID', 30, 48),
  pos('mid-r', 'Right Midfield', 'MID', 70, 48),
  pos('fwd-c', 'Striker', 'FWD', 50, 20),
]);

const F_7_3_1_2 = formation('7v7', '7v7-3-1-2', '3-1-2', [
  pos('def-l', 'Left Back', 'DEF', 18, 76),
  pos('def-c', 'Center Back', 'DEF', 50, 78),
  pos('def-r', 'Right Back', 'DEF', 82, 76),
  pos('mid-c', 'Center Midfield', 'MID', 50, 48),
  pos('fwd-l', 'Left Forward', 'FWD', 32, 20),
  pos('fwd-r', 'Right Forward', 'FWD', 68, 20),
]);

const F_7_1_3_2 = formation('7v7', '7v7-1-3-2', '1-3-2', [
  pos('def-c', 'Center Back', 'DEF', 50, 76),
  pos('mid-l', 'Left Midfield', 'MID', 18, 48),
  pos('mid-c', 'Center Midfield', 'MID', 50, 48),
  pos('mid-r', 'Right Midfield', 'MID', 82, 48),
  pos('fwd-l', 'Left Forward', 'FWD', 32, 20),
  pos('fwd-r', 'Right Forward', 'FWD', 68, 20),
]);

// ---------------------------------------------------------------------------
// 9v9 formations (8 outfield players + GK)
// ---------------------------------------------------------------------------

const F_9_3_3_2 = formation('9v9', '9v9-3-3-2', '3-3-2', [
  pos('def-l', 'Left Back', 'DEF', 18, 76),
  pos('def-c', 'Center Back', 'DEF', 50, 78),
  pos('def-r', 'Right Back', 'DEF', 82, 76),
  pos('mid-l', 'Left Midfield', 'MID', 18, 48),
  pos('mid-c', 'Center Midfield', 'MID', 50, 48),
  pos('mid-r', 'Right Midfield', 'MID', 82, 48),
  pos('fwd-l', 'Left Forward', 'FWD', 32, 20),
  pos('fwd-r', 'Right Forward', 'FWD', 68, 20),
]);

const F_9_3_2_3 = formation('9v9', '9v9-3-2-3', '3-2-3', [
  pos('def-l', 'Left Back', 'DEF', 18, 76),
  pos('def-c', 'Center Back', 'DEF', 50, 78),
  pos('def-r', 'Right Back', 'DEF', 82, 76),
  pos('mid-l', 'Left Midfield', 'MID', 30, 50),
  pos('mid-r', 'Right Midfield', 'MID', 70, 50),
  pos('fwd-l', 'Left Forward', 'FWD', 18, 20),
  pos('fwd-c', 'Center Forward', 'FWD', 50, 16),
  pos('fwd-r', 'Right Forward', 'FWD', 82, 20),
]);

const F_9_2_3_3 = formation('9v9', '9v9-2-3-3', '2-3-3', [
  pos('def-l', 'Left Back', 'DEF', 28, 76),
  pos('def-r', 'Right Back', 'DEF', 72, 76),
  pos('mid-l', 'Left Midfield', 'MID', 18, 48),
  pos('mid-c', 'Center Midfield', 'MID', 50, 48),
  pos('mid-r', 'Right Midfield', 'MID', 82, 48),
  pos('fwd-l', 'Left Forward', 'FWD', 18, 20),
  pos('fwd-c', 'Center Forward', 'FWD', 50, 16),
  pos('fwd-r', 'Right Forward', 'FWD', 82, 20),
]);

const F_9_4_3_1 = formation('9v9', '9v9-4-3-1', '4-3-1', [
  pos('def-l', 'Left Back', 'DEF', 14, 76),
  pos('def-cl', 'Left Center Back', 'DEF', 38, 78),
  pos('def-cr', 'Right Center Back', 'DEF', 62, 78),
  pos('def-r', 'Right Back', 'DEF', 86, 76),
  pos('mid-l', 'Left Midfield', 'MID', 18, 48),
  pos('mid-c', 'Center Midfield', 'MID', 50, 48),
  pos('mid-r', 'Right Midfield', 'MID', 82, 48),
  pos('fwd-c', 'Striker', 'FWD', 50, 18),
]);

// ---------------------------------------------------------------------------
// 11v11 formations (10 outfield players + GK)
// ---------------------------------------------------------------------------

const F_11_4_4_2 = formation('11v11', '11v11-4-4-2', '4-4-2', [
  pos('def-l', 'Left Back', 'DEF', 12, 78),
  pos('def-cl', 'Left Center Back', 'DEF', 37, 80),
  pos('def-cr', 'Right Center Back', 'DEF', 63, 80),
  pos('def-r', 'Right Back', 'DEF', 88, 78),
  pos('mid-l', 'Left Midfield', 'MID', 12, 50),
  pos('mid-cl', 'Left Center Midfield', 'MID', 37, 52),
  pos('mid-cr', 'Right Center Midfield', 'MID', 63, 52),
  pos('mid-r', 'Right Midfield', 'MID', 88, 50),
  pos('fwd-l', 'Left Forward', 'FWD', 34, 18),
  pos('fwd-r', 'Right Forward', 'FWD', 66, 18),
]);

const F_11_4_3_3 = formation('11v11', '11v11-4-3-3', '4-3-3', [
  pos('def-l', 'Left Back', 'DEF', 12, 78),
  pos('def-cl', 'Left Center Back', 'DEF', 37, 80),
  pos('def-cr', 'Right Center Back', 'DEF', 63, 80),
  pos('def-r', 'Right Back', 'DEF', 88, 78),
  pos('mid-l', 'Left Midfield', 'MID', 22, 50),
  pos('mid-c', 'Center Midfield', 'MID', 50, 52),
  pos('mid-r', 'Right Midfield', 'MID', 78, 50),
  pos('fwd-l', 'Left Wing', 'FWD', 15, 18),
  pos('fwd-c', 'Center Forward', 'FWD', 50, 14),
  pos('fwd-r', 'Right Wing', 'FWD', 85, 18),
]);

const F_11_4_2_3_1 = formation('11v11', '11v11-4-2-3-1', '4-2-3-1', [
  pos('def-l', 'Left Back', 'DEF', 12, 80),
  pos('def-cl', 'Left Center Back', 'DEF', 37, 82),
  pos('def-cr', 'Right Center Back', 'DEF', 63, 82),
  pos('def-r', 'Right Back', 'DEF', 88, 80),
  pos('mid-dl', 'Left Defensive Mid', 'MID', 35, 58),
  pos('mid-dr', 'Right Defensive Mid', 'MID', 65, 58),
  pos('mid-al', 'Left Attacking Mid', 'MID', 15, 34),
  pos('mid-ac', 'Center Attacking Mid', 'MID', 50, 32),
  pos('mid-ar', 'Right Attacking Mid', 'MID', 85, 34),
  pos('fwd-c', 'Striker', 'FWD', 50, 12),
]);

const F_11_3_5_2 = formation('11v11', '11v11-3-5-2', '3-5-2', [
  pos('def-l', 'Left Back', 'DEF', 20, 80),
  pos('def-c', 'Center Back', 'DEF', 50, 82),
  pos('def-r', 'Right Back', 'DEF', 80, 80),
  pos('mid-l', 'Left Wing Mid', 'MID', 8, 52),
  pos('mid-cl', 'Left Center Mid', 'MID', 33, 54),
  pos('mid-c', 'Center Mid', 'MID', 50, 48),
  pos('mid-cr', 'Right Center Mid', 'MID', 67, 54),
  pos('mid-r', 'Right Wing Mid', 'MID', 92, 52),
  pos('fwd-l', 'Left Forward', 'FWD', 34, 18),
  pos('fwd-r', 'Right Forward', 'FWD', 66, 18),
]);

const F_11_3_4_3 = formation('11v11', '11v11-3-4-3', '3-4-3', [
  pos('def-l', 'Left Back', 'DEF', 20, 80),
  pos('def-c', 'Center Back', 'DEF', 50, 82),
  pos('def-r', 'Right Back', 'DEF', 80, 80),
  pos('mid-l', 'Left Midfield', 'MID', 10, 52),
  pos('mid-cl', 'Left Center Midfield', 'MID', 37, 54),
  pos('mid-cr', 'Right Center Midfield', 'MID', 63, 54),
  pos('mid-r', 'Right Midfield', 'MID', 90, 52),
  pos('fwd-l', 'Left Wing', 'FWD', 15, 18),
  pos('fwd-c', 'Center Forward', 'FWD', 50, 14),
  pos('fwd-r', 'Right Wing', 'FWD', 85, 18),
]);

export const FORMATIONS: Formation[] = [
  F_7_2_3_1,
  F_7_2_2_2,
  F_7_3_2_1,
  F_7_3_1_2,
  F_7_1_3_2,
  F_9_3_3_2,
  F_9_3_2_3,
  F_9_2_3_3,
  F_9_4_3_1,
  F_11_4_4_2,
  F_11_4_3_3,
  F_11_4_2_3_1,
  F_11_3_5_2,
  F_11_3_4_3,
];

export function getFormationsForFormat(format: MatchFormat): Formation[] {
  return FORMATIONS.filter((f) => f.format === format);
}

export function getFormationById(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id);
}

export function getDefaultFormationForFormat(format: MatchFormat): Formation {
  const list = getFormationsForFormat(format);
  if (list.length === 0) {
    throw new Error(`No formations defined for format ${format}`);
  }
  return list[0];
}
