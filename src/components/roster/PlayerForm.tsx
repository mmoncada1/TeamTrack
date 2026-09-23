import { useEffect, useId, useRef, useState } from 'react';
import type { Player, PlayerAvailability, PlayerGender, PositionGroup } from '../../types';
import { PLAYER_GENDER_LABELS, POSITION_GROUP_LABELS } from '../../types';
import type { PlayerFormInput } from '../../state/rosterStore';
import type { FieldError } from '../../lib/validation';
import { Button } from '../common/Button';
import { usePlayerPhotoUrl } from '../../hooks/usePlayerPhoto';
import { getInitials } from '../../lib/photo';
import { playerPositionGroups } from '../../lib/playerPositions';

interface PlayerFormProps {
  initial?: Player;
  /** Co-ed teams must record girl or boy so matches can count girls on the field. */
  requireGender?: boolean;
  onSubmit: (input: PlayerFormInput) => Promise<{ errors: FieldError[] }>;
  onCancel: () => void;
  submitLabel: string;
}

const GROUPS: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];

export function PlayerForm({ initial, requireGender, onSubmit, onCancel, submitLabel }: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [jerseyNumber, setJerseyNumber] = useState<string>(
    initial?.jerseyNumber != null ? String(initial.jerseyNumber) : '',
  );
  const [preferredGroups, setPreferredGroups] = useState<PositionGroup[]>(
    initial ? playerPositionGroups(initial) : ['MID'],
  );
  const [gender, setGender] = useState<PlayerGender | ''>(initial?.gender ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [availability, setAvailability] = useState<PlayerAvailability>(initial?.availability ?? 'active');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingPhotoUrl = usePlayerPhotoUrl(initial?.id, initial?.photoId);

  const nameId = useId();
  const jerseyId = useId();
  const groupId = useId();
  const notesId = useId();

  useEffect(() => {
    if (!photoFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function errorFor(field: string): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await onSubmit({
      name,
      jerseyNumber,
      preferredGroups,
      gender: requireGender ? gender : undefined,
      notes,
      availability,
      photoFile,
      removePhoto,
    });
    setSubmitting(false);
    if (result.errors.length > 0) {
      setErrors(result.errors);
    }
  }

  const displayPhotoUrl = removePhoto ? null : previewUrl ?? existingPhotoUrl;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {displayPhotoUrl ? (
            <img
              src={displayPhotoUrl}
              alt={name ? `Preview photo of ${name}` : 'Preview photo'}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-300"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-300 text-lg font-semibold text-slate-700 dark:bg-slate-600 dark:text-slate-100">
              {getInitials(name || '?')}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="photo-upload" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Profile picture (optional)
          </label>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              id="photo-upload"
              type="file"
              accept="image/*"
              className="text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setPhotoFile(file);
                setRemovePhoto(false);
              }}
            />
            {(displayPhotoUrl || existingPhotoUrl) && !removePhoto && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPhotoFile(null);
                  setRemovePhoto(true);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Photos are resized and stored only on this device.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor={nameId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Display name
        </label>
        <input
          id={nameId}
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700"
          aria-invalid={!!errorFor('name')}
          aria-describedby={errorFor('name') ? `${nameId}-error` : undefined}
        />
        {errorFor('name') && (
          <p id={`${nameId}-error`} className="mt-1 text-sm text-red-600" role="alert">
            {errorFor('name')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={jerseyId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Jersey number <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id={jerseyId}
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="—"
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700"
            aria-invalid={!!errorFor('jerseyNumber')}
            aria-describedby={errorFor('jerseyNumber') ? `${jerseyId}-error` : undefined}
          />
          {errorFor('jerseyNumber') && (
            <p id={`${jerseyId}-error`} className="mt-1 text-sm text-red-600" role="alert">
              {errorFor('jerseyNumber')}
            </p>
          )}
        </div>

        <fieldset>
          <legend id={groupId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Positions
          </legend>
          <p className="text-xs text-slate-500 dark:text-slate-400">Check every position they can play. The first one sets their color.</p>
          <div className="mt-1 flex flex-col gap-1">
            {GROUPS.map((group) => (
              <label key={group} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={preferredGroups.includes(group)}
                  onChange={() =>
                    setPreferredGroups((current) =>
                      current.includes(group) ? current.filter((item) => item !== group) : [...current, group],
                    )
                  }
                />
                {POSITION_GROUP_LABELS[group]}
              </label>
            ))}
          </div>
          {errorFor('preferredGroup') && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errorFor('preferredGroup')}
            </p>
          )}
        </fieldset>
      </div>

      {requireGender && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Gender</legend>
          <div className="mt-1 flex gap-4">
            {(['girl', 'boy'] as PlayerGender[]).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="gender"
                  checked={gender === option}
                  onChange={() => setGender(option)}
                />
                {PLAYER_GENDER_LABELS[option]}
              </label>
            ))}
          </div>
          {errorFor('gender') && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errorFor('gender')}
            </p>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Availability</legend>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="availability"
              checked={availability === 'active'}
              onChange={() => setAvailability('active')}
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="availability"
              checked={availability === 'unavailable'}
              onChange={() => setAvailability('unavailable')}
            />
            Unavailable
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor={notesId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Notes (optional)
        </label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
