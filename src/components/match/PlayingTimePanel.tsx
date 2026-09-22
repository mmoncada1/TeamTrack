import type { Player, PlayerRuntimeState } from '../../types';
import { comparePlayersByJersey, jerseyLabel } from '../../lib/playerSort';
import { formatClock } from '../../lib/timer';

interface PlayingTimePanelProps {
  players: Player[];
  playerStates: Record<string, PlayerRuntimeState>;
}

export function PlayingTimePanel({ players, playerStates }: PlayingTimePanelProps) {
  const rows = [...players].sort(comparePlayersByJersey);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-lg font-semibold">Time tracker</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Now is the current stretch on the field or bench. Field and Bench are overall totals for this match.
      </p>
      <div className="mt-2 max-h-80 overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
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
                    <td className="py-1.5 pr-2">
                      {jerseyLabel(player.jerseyNumber)} {player.name}
                    </td>
                    <td colSpan={3}>Unavailable</td>
                  </tr>
                );
              }
              const onField = state.status === 'field';
              return (
                <tr key={player.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1.5 pr-2 font-medium">
                    {jerseyLabel(player.jerseyNumber)} {player.name}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    <span className={onField ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}>
                      {onField ? 'Field' : 'Bench'} {formatClock(state.currentStintMs)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 font-semibold tabular-nums">{formatClock(state.totalFieldMs)}</td>
                  <td className="py-1.5 font-semibold tabular-nums">{formatClock(state.totalBenchMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
