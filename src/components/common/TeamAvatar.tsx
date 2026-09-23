import clsx from 'clsx';
import type { Team } from '../../types';
import { useTeamPhotoUrl } from '../../hooks/usePlayerPhoto';
import { getInitials } from '../../lib/photo';

interface TeamAvatarProps {
  team: Pick<Team, 'id' | 'name' | 'photoId'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-base',
};

export function TeamAvatar({ team, size = 'md', className }: TeamAvatarProps) {
  const url = useTeamPhotoUrl(team.id, team.photoId);

  if (url) {
    return (
      <img
        src={url}
        alt={`Photo of ${team.name}`}
        className={clsx('rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${team.name} (no photo, showing initials)`}
      className={clsx(
        'flex items-center justify-center rounded-full bg-emerald-600 font-bold text-white',
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(team.name)}
    </div>
  );
}
