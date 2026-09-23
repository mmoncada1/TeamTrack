import { useEffect, useRef } from 'react';

const COLORS = ['#059669', '#34d399', '#facc15', '#ffffff', '#fb7185'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  spinSpeed: number;
}

/**
 * A short burst from the top of the screen. It does not block clicks.
 */
export function GoalConfetti({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const pieces: Piece[] = Array.from({ length: 48 }, () => ({
      x: width * (0.25 + Math.random() * 0.5),
      y: height * 0.28 + Math.random() * 24,
      vx: (Math.random() - 0.5) * 7,
      vy: -5 - Math.random() * 4,
      size: 5 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0],
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.3,
    }));

    const started = performance.now();
    let frame = 0;

    function tick(now: number) {
      const elapsed = now - started;
      if (elapsed > 1400) {
        onDoneRef.current();
        return;
      }
      ctx!.clearRect(0, 0, width, height);
      for (const piece of pieces) {
        piece.vy += 0.18;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.spin += piece.spinSpeed;
        ctx!.save();
        ctx!.translate(piece.x, piece.y);
        ctx!.rotate(piece.spin);
        ctx!.fillStyle = piece.color;
        ctx!.globalAlpha = elapsed > 900 ? Math.max(0, 1 - (elapsed - 900) / 500) : 1;
        ctx!.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        ctx!.restore();
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[80]" aria-hidden />;
}
