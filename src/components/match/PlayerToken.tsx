import { useDraggable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { Player, PlayerRuntimeState } from '../../types';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { formatClock } from '../../lib/timer';

interface PlayerTokenProps {
  player: Player;
  slotId: string; // current slot ('BENCH' or positionId), used as the unique drag id source
  disabled?: boolean;
  state?: PlayerRuntimeState;
  showTimer?: boolean;
  alertActive?: boolean;
  onRequestMove?: (playerId: string) => void;
  compact?: boolean;
}

export function PlayerToken({
  player,
  slotId,
  disabled,
  state,
  showTimer,
  alertActive,
  onRequestMove,
  compact,
}: PlayerTokenProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `player:${player.id}`,
    data: { playerId: player.id, fromSlot: slotId },
    disabled,
  });

  const timerMs = state ? (state.status === 'field' ? state.currentStintMs : state.currentStintMs) : 0;

  return (
    <div
      className={clsx(
        'group relative flex flex-col items-center gap-0.5 rounded-lg p-1 text-center transition-opacity',
        isDragging && 'opacity-40',
        compact ? 'w-16' : 'w-20',
      )}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        tabIndex={-1}
        className={clsx(
          'relative cursor-grab touch-none rounded-full ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-600 active:cursor-grabbing',
          alertActive && 'alert-pulse ring-2 ring-red-500',
          disabled && 'cursor-default opacity-70',
        )}
      >
        <PlayerAvatar player={player} size={compact ? 'sm' : 'md'} />
        {player.jerseyNumber != null && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-800">
            {player.jerseyNumber}
          </span>
        )}
        {alertActive && (
          <span
            className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white"
            aria-hidden
          >
            !
          </span>
        )}
      </div>
      <span className="w-full truncate text-[11px] font-medium leading-tight">{player.name}</span>
      {showTimer && state && (
        <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
          {formatClock(timerMs)}
        </span>
      )}
      {onRequestMove && (
        <button
          type="button"
          onClick={() => onRequestMove(player.id)}
          className="rounded border border-slate-300 bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 opacity-0 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200"
        >
          Move…
        </button>
      )}
    </div>
  );
}
