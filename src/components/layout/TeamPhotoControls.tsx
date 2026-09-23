import { useEffect, useId, useState } from 'react';
import { useTeamPhotoUrl } from '../../hooks/usePlayerPhoto';
import { getInitials } from '../../lib/photo';
import { Button } from '../common/Button';

interface TeamPhotoControlsProps {
  name: string;
  teamId?: string;
  photoId?: string;
  file: File | null;
  remove: boolean;
  onFile: (file: File | null) => void;
  onRemove: () => void;
}

export function TeamPhotoControls({ name, teamId, photoId, file, remove, onFile, onRemove }: TeamPhotoControlsProps) {
  const inputId = useId();
  const existingUrl = useTeamPhotoUrl(remove ? undefined : teamId, remove ? undefined : photoId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const displayUrl = remove ? null : previewUrl ?? existingUrl;

  return (
    <div className="mt-3 flex items-center gap-3">
      {displayUrl ? (
        <img src={displayUrl} alt={name ? `Photo of ${name}` : 'Team photo'} className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
          {getInitials(name || '?')}
        </div>
      )}
      <div>
        <label htmlFor={inputId} className="block text-sm font-medium">
          Team photo
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="mt-1 text-sm"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {(displayUrl || existingUrl) && !remove && (
          <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={onRemove}>
            Remove photo
          </Button>
        )}
        <p className="mt-1 text-xs text-slate-500">Stored only on this device.</p>
      </div>
    </div>
  );
}
