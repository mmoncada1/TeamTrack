// Run before AppState loads browser records. Rewrite every reference to a
// legacy generated ID in one pass, including IDs embedded in storage keys.
const legacyId = /\b(?:team|player|lineup|match|formation|play|slot|action|drawing|drive|call)-\d+-0\.\d+(?:-\d+)?\b/g;

export function migrateLocalIds(storage, makeUuid = () => crypto.randomUUID()) {
  const keys = Object.keys(storage).filter((key) => key.startsWith("teamtrack:"));
  const ids = new Map();
  for (const key of keys) {
    const value = storage.getItem(key);
    for (const id of `${key}\n${value ?? ""}`.matchAll(legacyId)) {
      if (!ids.has(id[0])) ids.set(id[0], makeUuid());
    }
  }
  if (!ids.size) return 0;
  const rewrite = (value) => value.replace(legacyId, (id) => ids.get(id));
  // Write all updated values before removing old keys, so an interruption
  // cannot discard a record. The operation is safe to rerun.
  for (const key of keys) storage.setItem(rewrite(key), rewrite(storage.getItem(key) ?? ""));
  for (const key of keys) if (rewrite(key) !== key) storage.removeItem(key);
  return ids.size;
}

if (typeof window !== "undefined") migrateLocalIds(window.localStorage);
