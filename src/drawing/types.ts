export interface Point {
  x: number;
  y: number;
}

export type DrawingTool = 'select' | 'pen' | 'line' | 'arrow' | 'erase';
export interface Drawing {
  id: string;
  tool: 'pen' | 'line' | 'arrow';
  color: string;
  width: number;
  points: Point[];
}
