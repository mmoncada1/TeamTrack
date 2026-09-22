import type { Alert, Player } from '../../types';
import { POSITION_GROUP_LABELS } from '../../types';
import { Button } from '../common/Button';

interface AlertsPanelProps {
  alerts: Alert[];
  playersById: Map<string, Player>;
  onAccept: (alert: Alert) => void;
  onDismiss: (alertId: string) => void;
  onSnooze: (alertId: string) => void;
}

export function AlertsPanel({ alerts, playersById, onAccept, onDismiss, onSnooze }: AlertsPanelProps) {
  const visible = alerts.filter((a) => a.status === 'active');
  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        No playing-time alerts right now.
      </div>
    );
  }

  return (
    <div className="space-y-2" role="region" aria-label="Substitution alerts">
      {visible.map((alert) => {
        const player = playersById.get(alert.playerId);
        const inPlayer = alert.recommendation ? playersById.get(alert.recommendation.inPlayerId) : undefined;
        return (
          <div
            key={alert.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-red-400 bg-red-50 p-3 dark:border-red-700 dark:bg-red-950/40"
          >
            <div>
              <p className="font-semibold text-red-800 dark:text-red-200">
                ⚠ {player?.name ?? 'Player'} has reached the {POSITION_GROUP_LABELS[alert.positionGroup]} threshold (
                {alert.thresholdMinutes} min).
              </p>
              {alert.recommendation && (
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{alert.recommendation.explanation}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {alert.recommendation && (
                <Button variant="primary" size="sm" onClick={() => onAccept(alert)}>
                  Sub in {inPlayer?.name ?? 'player'}
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => onSnooze(alert.id)}>
                Snooze 3 min
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDismiss(alert.id)}>
                Dismiss
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
