import type { Alert, Player } from '../../types';
import { Button } from '../common/Button';
import { POSITION_COLORS } from './positionColors';

interface AlertsPanelProps {
  alerts: Alert[];
  playersById: Map<string, Player>;
  onAccept: (alert: Alert) => void;
  onDismiss: (alertId: string) => void;
}

export function AlertsPanel({ alerts, playersById, onAccept, onDismiss }: AlertsPanelProps) {
  const visible = alerts.filter((a) => a.status === 'active');
  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        No alerts
      </div>
    );
  }

  return (
    <div className="space-y-1.5" role="region" aria-label="Substitution alerts">
      {visible.map((alert) => {
        const player = playersById.get(alert.playerId);
        const inPlayer = alert.recommendation ? playersById.get(alert.recommendation.inPlayerId) : undefined;
        const name = player
          ? `${player.name} (${POSITION_COLORS[player.preferredGroup].abbr})`
          : 'Player';
        const inLabel = inPlayer
          ? `Sub in ${inPlayer.name} (${POSITION_COLORS[inPlayer.preferredGroup].abbr})`
          : '';
        return (
          <div
            key={alert.id}
            className="rounded-lg border border-red-400 bg-red-50 px-2 py-1.5 dark:border-red-700 dark:bg-red-950/40"
          >
            <div className="flex items-center gap-1">
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-red-800 dark:text-red-200" title={name}>
                {name}
              </p>
              <button
                type="button"
                onClick={() => onDismiss(alert.id)}
                className="shrink-0 rounded px-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900"
                aria-label={`Dismiss ${name}`}
              >
                Dismiss
              </button>
            </div>
            {inPlayer && (
              <Button variant="primary" size="sm" className="mt-1 w-full whitespace-normal text-center leading-tight" onClick={() => onAccept(alert)}>
                {inLabel}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
