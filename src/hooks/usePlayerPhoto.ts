import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { blobToObjectUrl } from '../lib/photo';

/** Reactively resolve a player's stored photo (if any) to a displayable object URL. */
export function usePlayerPhotoUrl(playerId: string | undefined, photoId: string | undefined): string | null {
  const photo = useLiveQuery(
    () => (playerId ? db.photos.where('playerId').equals(playerId).first() : undefined),
    [playerId, photoId],
  );

  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) {
      setUrl(null);
      return;
    }
    const objectUrl = blobToObjectUrl(photo.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  return url;
}
