import { Button } from '../components/common/Button';
import type { DrawingTool } from './types';

interface Props {
  tool: DrawingTool;
  onTool: (tool: DrawingTool) => void;
  color: string;
  onColor: (color: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
}
export function DrawingToolbar({
  tool,
  onTool,
  color,
  onColor,
  undo,
  redo,
  canUndo,
  canRedo,
  clear,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Drawing tools">
      {(['select', 'pen', 'line', 'arrow', 'erase'] as const).map((t) => (
        <Button
          key={t}
          size="sm"
          variant={tool === t ? 'primary' : 'secondary'}
          onClick={() => onTool(t)}
        >
          {t === 'select'
            ? 'Select / move'
            : t === 'erase'
              ? 'Erase'
              : t[0].toUpperCase() + t.slice(1)}
        </Button>
      ))}
      <label className="flex items-center gap-1 text-sm">
        Ink{' '}
        <input
          aria-label="Ink color"
          type="color"
          value={color}
          onChange={(e) => onColor(e.target.value)}
        />
      </label>
      <Button size="sm" variant="secondary" disabled={!canUndo} onClick={undo}>
        Undo
      </Button>
      <Button size="sm" variant="secondary" disabled={!canRedo} onClick={redo}>
        Redo
      </Button>
      <Button size="sm" variant="secondary" onClick={clear}>
        Clear drawings
      </Button>
    </div>
  );
}
