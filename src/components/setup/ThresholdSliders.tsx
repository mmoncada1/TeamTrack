import type { PositionGroup, ThresholdSettings } from '../../types';
import { POSITION_GROUP_LABELS } from '../../types';

interface ThresholdSlidersProps {
  thresholds: ThresholdSettings;
  onChange: (group: PositionGroup, next: { enabled: boolean; minutes: number }) => void;
}

const GROUPS: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];

export function ThresholdSliders({ thresholds, onChange }: ThresholdSlidersProps) {
  return (
    <div className="space-y-3">
      {GROUPS.map((group) => {
        const t = thresholds[group];
        const inputId = `threshold-${group}`;
        return (
          <div key={group} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <label htmlFor={inputId} className="text-sm font-medium">
                {POSITION_GROUP_LABELS[group]} playing-time alert
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={t.enabled}
                  onChange={(e) => onChange(group, { enabled: e.target.checked, minutes: t.minutes })}
                />
                Enabled
              </label>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                id={inputId}
                type="range"
                min={1}
                max={30}
                step={1}
                value={t.minutes}
                disabled={!t.enabled}
                onChange={(e) => onChange(group, { enabled: t.enabled, minutes: Number(e.target.value) })}
                className="flex-1 disabled:opacity-40"
                aria-valuetext={`${t.minutes} minutes`}
              />
              <span className="w-20 shrink-0 tabular-nums text-xs">
                {t.minutes} minute{t.minutes === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
