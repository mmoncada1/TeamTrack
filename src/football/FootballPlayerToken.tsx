import { useId } from 'react';
import type { Player } from '../types';
import type { FootballPlayerAssignment } from './types';
import { usePlayerPhotoUrl } from '../hooks/usePlayerPhoto';
import { getInitials } from '../lib/photo';

/** SVG avatar uses the same reactive, locally stored photos as the roster. */
export function FootballPlayerToken({
  slot,
  player,
  quarterback,
  snapper,
  selected,
}: {
  slot: FootballPlayerAssignment;
  player?: Player;
  quarterback: boolean;
  snapper: boolean;
  selected: boolean;
}) {
  const photo = usePlayerPhotoUrl(player?.id, player?.photoId);
  const clip = `football-photo-${useId().replace(/:/g, '')}`;
  const { x, y } = slot.position;
  const color = quarterback ? '#d97706' : snapper ? '#2563eb' : '#f8fafc';
  return (
    <g pointerEvents="none">
      <circle
        cx={x}
        cy={y}
        r="3.1"
        fill={color}
        stroke={selected ? '#facc15' : '#0f172a'}
        strokeWidth={selected ? 1 : 0.5}
      />
      {photo ? (
        <>
          <defs>
            <clipPath id={clip}>
              <circle cx={x} cy={y} r="2.65" />
            </clipPath>
          </defs>
          <image
            href={photo}
            x={x - 2.65}
            y={y - 2.65}
            width="5.3"
            height="5.3"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clip})`}
            role="img"
            aria-label={`Photo of ${player?.name}`}
          />
        </>
      ) : (
        <text
          x={x}
          y={y + 0.9}
          textAnchor="middle"
          fill={quarterback || snapper ? 'white' : '#0f172a'}
          fontSize="2.6"
          fontWeight="bold"
        >
          {player ? getInitials(player.name) : slot.label}
        </text>
      )}
      {player && (
        <>
          <rect
            x={x - 2.4}
            y={y + 1.8}
            width="4.8"
            height="2.2"
            rx=".6"
            fill={quarterback || snapper ? color : '#0f172a'}
          />
          <text
            x={x}
            y={y + 3.45}
            textAnchor="middle"
            fill="white"
            fontSize="1.7"
            fontWeight="bold"
          >
            {slot.label}
          </text>
          <text
            x={x}
            y={y + 5.7}
            textAnchor="middle"
            fill="white"
            stroke="#174b35"
            strokeWidth=".5"
            paintOrder="stroke"
            fontSize="1.8"
            fontWeight="bold"
          >
            {player.name.length > 16 ? `${player.name.slice(0, 15)}…` : player.name}
          </text>
        </>
      )}
    </g>
  );
}
