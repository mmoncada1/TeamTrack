import { useCallback, useEffect, useRef, useState } from 'react';
import { useTeamStore } from '../state/teamStore';
import { createId } from '../lib/id';
import { Button } from '../components/common/Button';

type Tool = 'pen' | 'erase' | 'text';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  tool: 'pen' | 'erase';
  color: string;
  width: number;
  points: Point[];
}

interface Note {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface BoardState {
  strokes: Stroke[];
  notes: Note[];
}

const COLORS = ['#ffffff', '#facc15', '#ef4444', '#38bdf8', '#111827'];
const WIDTHS = [3, 6, 10];

function storageKey(teamId: string): string {
  return `teamtrack:whiteboard:${teamId}`;
}

function emptyBoard(): BoardState {
  return { strokes: [], notes: [] };
}

function loadBoard(teamId: string): BoardState {
  try {
    const raw = localStorage.getItem(storageKey(teamId));
    if (!raw) return emptyBoard();
    const parsed = JSON.parse(raw) as Partial<BoardState>;
    return {
      strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return emptyBoard();
  }
}

function saveBoard(teamId: string, board: BoardState): void {
  try {
    localStorage.setItem(storageKey(teamId), JSON.stringify(board));
  } catch {
    // Ignore quota errors; the drawing still exists for this session.
  }
}

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.color;
    ctx.globalCompositeOperation = stroke.tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function WhiteboardPage() {
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamName = useTeamStore((s) => s.teams.find((team) => team.id === s.activeTeamId)?.name ?? 'Team');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const cancelNote = useRef(false);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[1]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [board, setBoard] = useState<BoardState>(emptyBoard);
  const [undoStack, setUndoStack] = useState<BoardState[]>([]);
  const [draftNote, setDraftNote] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    if (!activeTeamId) return;
    setBoard(loadBoard(activeTeamId));
    setUndoStack([]);
    setDraftNote(null);
  }, [activeTeamId]);

  const paint = useCallback((strokes: Stroke[]) => {
    const canvas = canvasRef.current;
    const pitch = pitchRef.current;
    if (!canvas || !pitch) return;
    const rect = pitch.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.floor(rect.width * ratio));
    const nextHeight = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawStrokes(ctx, strokes, rect.width, rect.height);
  }, []);

  useEffect(() => {
    paint(board.strokes);
  }, [board.strokes, paint]);

  useEffect(() => {
    const pitch = pitchRef.current;
    if (!pitch) return;
    const observer = new ResizeObserver(() => paint(board.strokes));
    observer.observe(pitch);
    return () => observer.disconnect();
  }, [board.strokes, paint]);

  function remember(next: BoardState) {
    setUndoStack((stack) => [...stack, board]);
    setBoard(next);
    if (activeTeamId) saveBoard(activeTeamId, next);
  }

  function pointFromEvent(event: React.PointerEvent): Point | null {
    const pitch = pitchRef.current;
    if (!pitch) return null;
    const rect = pitch.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === 'text') {
      const point = pointFromEvent(event);
      if (!point) return;
      setDraftNote({ x: point.x, y: point.y, text: '' });
      return;
    }
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = {
      id: createId(),
      tool: tool === 'erase' ? 'erase' : 'pen',
      color,
      width: tool === 'erase' ? Math.max(width * 3, 14) : width,
      points: [point],
    };
    paint([...board.strokes, drawing.current]);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = drawing.current;
    if (!stroke) return;
    const point = pointFromEvent(event);
    if (!point) return;
    stroke.points.push(point);
    paint([...board.strokes, stroke]);
  }

  function onPointerUp() {
    const stroke = drawing.current;
    drawing.current = null;
    if (!stroke || stroke.points.length === 0) return;
    remember({ ...board, strokes: [...board.strokes, stroke] });
  }

  function commitNote() {
    if (cancelNote.current) {
      cancelNote.current = false;
      setDraftNote(null);
      return;
    }
    if (!draftNote || !draftNote.text.trim()) {
      setDraftNote(null);
      return;
    }
    const note: Note = {
      id: createId(),
      x: draftNote.x,
      y: draftNote.y,
      text: draftNote.text.trim(),
      color,
    };
    remember({ ...board, notes: [...board.notes, note] });
    setDraftNote(null);
  }

  function undo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setBoard(previous);
    if (activeTeamId) saveBoard(activeTeamId, previous);
  }

  function clearBoard() {
    if (board.strokes.length === 0 && board.notes.length === 0) return;
    remember(emptyBoard());
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 p-3 wide:flex-row sm:p-4">
      <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 wide:w-44 wide:flex-col wide:items-stretch">
        <h1 className="w-full text-base font-bold">Whiteboard</h1>
        <p className="w-full text-xs text-slate-500 dark:text-slate-400">
          Draw on the pitch for {teamName}. It stays on this device.
        </p>
        <div className="flex gap-1 sm:flex-col">
          <Button size="sm" variant={tool === 'pen' ? 'primary' : 'secondary'} onClick={() => setTool('pen')}>
            Pen
          </Button>
          <Button size="sm" variant={tool === 'erase' ? 'primary' : 'secondary'} onClick={() => setTool('erase')}>
            Eraser
          </Button>
          <Button size="sm" variant={tool === 'text' ? 'primary' : 'secondary'} onClick={() => setTool('text')}>
            Note
          </Button>
        </div>
        <div className="flex gap-1" role="group" aria-label="Ink color">
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Color ${swatch}`}
              className="h-7 w-7 rounded-full border-2"
              style={{ backgroundColor: swatch, borderColor: color === swatch ? '#2563eb' : '#cbd5e1' }}
              onClick={() => {
                setColor(swatch);
                if (tool === 'erase') setTool('pen');
              }}
            />
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="Line thickness">
          {WIDTHS.map((size) => (
            <button
              key={size}
              type="button"
              aria-label={`${size} pixel line`}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                width === size ? 'border-blue-600' : 'border-slate-300 dark:border-slate-600'
              }`}
              onClick={() => setWidth(size)}
            >
              <span className="rounded-full bg-slate-800 dark:bg-slate-100" style={{ width: size, height: size }} />
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={undo} disabled={undoStack.length === 0}>
          Undo
        </Button>
        <Button size="sm" variant="danger" onClick={clearBoard}>
          Clear
        </Button>
      </div>

      <div
        ref={pitchRef}
        className="relative mx-auto aspect-[2/3] h-[min(60vh,860px)] w-auto max-w-full overflow-hidden rounded-xl shadow-inner wide:h-[min(78vh,860px)]"
      >
        <svg viewBox="0 0 100 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <rect x="0" y="0" width="100" height="150" fill="#2e7d4f" />
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x="0" y={i * 18.75} width="100" height="9.375" fill={i % 2 === 0 ? '#2e7d4f' : '#2b7649'} />
          ))}
          <g stroke="white" strokeWidth="0.6" fill="none">
            <rect x="3" y="3" width="94" height="144" />
            <line x1="3" y1="75" x2="97" y2="75" />
            <circle cx="50" cy="75" r="9" />
            <circle cx="50" cy="75" r="0.8" fill="white" />
            <rect x="30" y="128" width="40" height="19" />
            <rect x="40" y="141" width="20" height="6" />
            <path d="M 38 128 A 12 12 0 0 1 62 128" />
            <rect x="30" y="3" width="40" height="19" />
            <rect x="40" y="3" width="20" height="6" />
            <path d="M 38 22 A 12 12 0 0 0 62 22" />
          </g>
        </svg>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {board.notes.map((note) => (
          <div
            key={note.id}
            className="pointer-events-none absolute max-w-[40%] -translate-x-1/2 -translate-y-1/2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold"
            style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%`, color: note.color }}
          >
            {note.text}
          </div>
        ))}
        {draftNote && (
          <form
            className="absolute z-10 -translate-x-1/2"
            style={{ left: `${draftNote.x * 100}%`, top: `${draftNote.y * 100}%` }}
            onSubmit={(event) => {
              event.preventDefault();
              event.currentTarget.querySelector('input')?.blur();
            }}
          >
            <input
              autoFocus
              className="input w-36 text-xs"
              placeholder="Instruction"
              value={draftNote.text}
              onChange={(event) => setDraftNote({ ...draftNote, text: event.target.value })}
              onBlur={commitNote}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  cancelNote.current = true;
                  event.currentTarget.blur();
                }
              }}
            />
          </form>
        )}
      </div>
    </div>
  );
}
