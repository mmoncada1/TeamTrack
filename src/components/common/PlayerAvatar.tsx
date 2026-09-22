import clsx from 'clsx';
import type { Player } from '../../types';
import { usePlayerPhotoUrl } from '../../hooks/usePlayerPhoto';
import { getInitials } from '../../lib/photo';

interface PlayerAvatarProps {
  player: Pick<Player, 'id' | 'name' | 'photoId'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
};

export function PlayerAvatar({ player, size = 'md', className }: PlayerAvatarProps) {
  const url = usePlayerPhotoUrl(player.id, player.photoId);

  if (url) {
    return (
      <img
        src={url}
        alt={`Photo of ${player.name}`}
        className={clsx('rounded-full object-cover ring-2 ring-white dark:ring-slate-800', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${player.name} (no photo, showing initials)`}
      className={clsx(
        'flex items-center justify-center rounded-full bg-slate-300 font-semibold text-slate-700 ring-2 ring-white dark:bg-slate-600 dark:text-slate-100 dark:ring-slate-800',
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(player.name)}
    </div>
  );
}
