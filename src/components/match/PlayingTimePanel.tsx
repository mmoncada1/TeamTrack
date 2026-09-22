import type { Player, PlayerRuntimeState, ThresholdSettings } from '../../types';
import { jerseyLabel } from '../../lib/playerSort';
import { formatClock, minutesToMs } from '../../lib/timer';

interface PlayingTimePanelProps {
  players: Player[];
  playerStates: Record<string, PlayerRuntimeState>;
  thresholds: ThresholdSettings;
  goalkeeperRotationEnabled: boolean;
}

const PAST_DUE_MS = minutesToMs(1);

type SubUrgency = 'ok' | 'due' | 'overdue';

function subUrgency(
  state: PlayerRuntimeState,
  thresholds: ThresholdSettings,
  goalkeeperRotationEnabled: boolean,
): SubUrgency {
  if (state.status !== 'field' || !state.positionGroup) return 'ok';
  if (state.positionGroup === 'GK' && !goalkeeperRotationEnabled) return 'ok';
  const threshold = thresholds[state.positionGroup];
  if (!threshold?.enabled) return 'ok';
  const dueAt = minutesToMs(threshold.minutes);
  if (state.currentStintMs >= dueAt + PAST_DUE_MS) return 'overdue';
  if (state.currentStintMs >= dueAt) return 'due';
  return 'ok';
}

export function PlayingTimePanel({
  players,
  playerStates,
  thresholds,
  goalkeeperRotationEnabled,
}: PlayingTimePanelProps) {
  const rows = [...players].sort((a, b) => {
    const aField = playerStates[a.id]?.totalFieldMs ?? -1;
    const bField = playerStates[b.id]?.totalFieldMs ?? -1;
    if (aField !== bField) return bField - aField;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-sm font-semibold">Time tracker</h2>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        Sorted by overall field time, longest first. Yellow in Now means they have reached their sub time. Red means they are at least 1 minute past it.
      </p>
      <div className="mt-2 max-h-80 overflow-y-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-white text-left text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="py-1 pr-2 font-medium">Player</th>
              <th className="py-1 pr-2 font-medium">Now</th>
              <th className="py-1 pr-2 font-medium">Field</th>
              <th className="py-1 font-medium">Bench</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((player) => {
              const state = playerStates[player.id];
              if (!state || state.status === 'unavailable') {
                return (
                  <tr key={player.id} className="border-t border-slate-100 text-slate-400 dark:border-slate-700">
                    <td className="py-1 pr-2">
                      {jerseyLabel(player.jerseyNumber)} {player.name}
                    </td>
                    <td colSpan={3}>Unavailable</td>
                  </tr>
                );
              }
              const onField = state.status === 'field';
              const urgency = subUrgency(state, thresholds, goalkeeperRotationEnabled);
              const nowClass =
                urgency === 'overdue'
                  ? 'bg-red-600 text-white'
                  : urgency === 'due'
                    ? 'bg-amber-400 text-slate-950'
                    : onField
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-600 dark:text-slate-300';
              const nowLabel =
                urgency === 'overdue' ? 'Past due' : urgency === 'due' ? 'Sub due' : onField ? 'Field' : 'Bench';
              return (
                <tr key={player.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1 pr-2 font-medium">
                    {jerseyLabel(player.jerseyNumber)} {player.name}
                  </td>
                  <td className="py-1 pr-2 tabular-nums">
                    <span className={`inline-block rounded px-1 py-0.5 font-semibold ${nowClass}`}>
                      {nowLabel} {formatClock(state.currentStintMs)}
                    </span>
                  </td>
                  <td className="py-1 pr-2 font-semibold tabular-nums">{formatClock(state.totalFieldMs)}</td>
                  <td className="py-1 font-semibold tabular-nums">{formatClock(state.totalBenchMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
