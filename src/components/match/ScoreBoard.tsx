import { Button } from '../common/Button';

interface ScoreBoardProps {
  teamName: string;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
  onRecordGoal: () => void;
  disabled?: boolean;
}

export function ScoreBoard({ teamName, opponentName, teamScore, opponentScore, onRecordGoal, disabled }: ScoreBoardProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2 text-center">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{teamName || 'Us'}</div>
          <div className="text-xl font-bold tabular-nums">{teamScore}</div>
        </div>
        <div className="text-sm text-slate-400">–</div>
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{opponentName || 'Opponent'}</div>
          <div className="text-xl font-bold tabular-nums">{opponentScore}</div>
        </div>
      </div>
      <Button variant="primary" size="sm" onClick={onRecordGoal} disabled={disabled}>
        + Goal
      </Button>
    </div>
  );
}
