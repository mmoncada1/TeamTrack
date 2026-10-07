// Convert the browser TypeScript app's version 5 export into Jac's backup shape.
const snake = (key) => /^[A-Z]+$/.test(key) ? key : key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

function convertKeys(value) {
  if (Array.isArray(value)) return value.map(convertKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [snake(key), convertKeys(child)]));
  }
  return value;
}

function indexPhotos(items, ownerField) {
  if (!Array.isArray(items)) throw new Error("The backup has an invalid photo collection.");
  const photos = new Map();
  for (const photo of items) {
    if (!photo || typeof photo.id !== "string" || typeof photo[ownerField] !== "string" ||
        typeof photo.dataUrl !== "string" || !/^data:image\/(jpeg|png|webp|gif);base64,/.test(photo.dataUrl) || photos.has(photo.id)) {
      throw new Error("A photo is missing its id, owner, or image data, or has a duplicate id.");
    }
    photos.set(photo.id, photo);
  }
  return photos;
}

function photoFor(owner, photos, ownerField) {
  if (!owner.photoId) return null;
  const photo = photos.get(owner.photoId);
  if (!photo || photo[ownerField] !== owner.id) throw new Error(`Photo ${owner.photoId} is missing or belongs to another record.`);
  return photo.dataUrl;
}

function convertEvent(event) {
  const { id, type, matchClockMs, timestamp, playerIds, note, ...details } = event;
  return {
    id, type, match_clock_ms: matchClockMs, timestamp,
    player_ids: playerIds || [], note: note ?? null, data: convertKeys(details),
  };
}

export function convertTypescriptBackup(source) {
  if (!source || source.version !== 5 || !Array.isArray(source.teams) ||
      !Array.isArray(source.players) || !Array.isArray(source.matches) ||
      !Array.isArray(source.lineups)) {
    throw new Error("The TypeScript backup needs version 5 teams, players, matches, and lineups.");
  }
  const playerPhotos = indexPhotos(source.photos || [], "playerId");
  const teamPhotos = indexPhotos(source.teamPhotos || [], "teamId");
  const teams = source.teams.map((team) => ({ ...convertKeys(team), photo_id: photoFor(team, teamPhotos, "teamId") }));
  const players = source.players.map((player) => ({
    ...convertKeys(player),
    preferred_group: player.preferredGroup || player.preferredGroups?.[0] || "MID",
    preferred_groups: player.preferredGroups || [player.preferredGroup || "MID"],
    availability: player.availability || "active",
    photo_id: photoFor(player, playerPhotos, "playerId"),
  }));
  const matches = source.matches.map((match) => ({
    ...convertKeys(match), events: match.events?.map(convertEvent),
  }));
  return {
    app: "TeamTrack Jac", schemaVersion: 1, exportedAt: source.exportedAt,
    data: {
      teams, players, matches, lineups: source.lineups.map(convertKeys),
      footballFormations: [], footballPlays: [], drivePlans: [], footballWhiteboards: [],
      activeTeamId: teams[0]?.id || "", appSettings: source.settings || {}, whiteboards: {},
    },
  };
}
