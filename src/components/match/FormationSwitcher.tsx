import { getFormationsForFormat } from '../../formations/definitions';
import type { MatchFormat } from '../../types';

interface FormationSwitcherProps {
  format: MatchFormat;
  formationId: string;
  onChange: (formationId: string) => void;
  disabled?: boolean;
}

export function FormationSwitcher({ format, formationId, onChange, disabled }: FormationSwitcherProps) {
  const formations = getFormationsForFormat(format);
  return (
    <div>
      <label htmlFor="live-formation" className="block text-xs font-medium">
        Formation
      </label>
      <select
        id="live-formation"
        className="input mt-1 max-w-xs"
        value={formationId}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {formations.map((f) => (
          <option key={f.id} value={f.id}>
            {f.shape}
          </option>
        ))}
      </select>
    </div>
  );
}
