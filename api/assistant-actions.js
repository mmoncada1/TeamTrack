const GROUPS = ["GK", "DEF", "MID", "FWD"];
const SETTINGS = {
  minimum_playing_time_minutes: [1, 120], assistant_accept_seconds: [1, 60],
  half_length_minutes: [1, 120], number_of_halves: [1, 2],
};

export function validateAssistantAction(raw, context) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const match = context.match || {};
  const settings = context.settings || {};
  const team = context.team || {};
  const players = context.team_players || context.players || [];
  const lineups = context.saved_lineups || [];
  const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  const short = (value) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 100;
  const player = players.find((item) => item.id === raw.player_id && item.team_id === match.team_id);
  if (raw.type === "match_setting" && Object.hasOwn(SETTINGS, raw.field)) {
    const [low, high] = SETTINGS[raw.field];
    return integer(raw.value, low, high) ? { type: raw.type, field: raw.field, value: raw.value,
      previous: settings[raw.field] } : null;
  }
  if (raw.type === "match_setting" && ["goalkeeper_rotation_enabled", "alert_sound_enabled"].includes(raw.field)) {
    return typeof raw.value === "boolean" ? { type: raw.type, field: raw.field, value: raw.value,
      previous: settings[raw.field] } : null;
  }
  if (raw.type === "threshold" && GROUPS.includes(raw.group) && settings.thresholds?.[raw.group]) {
    if (typeof raw.enabled !== "boolean" || !integer(raw.minutes, 1, 60)) return null;
    return { type: raw.type, group: raw.group, enabled: raw.enabled, minutes: raw.minutes,
      previous: settings.thresholds[raw.group] };
  }
  if (raw.type === "match_detail" && ["opponent_name", "team_name", "title", "date", "kickoff_time"].includes(raw.field)) {
    if (!short(raw.value) || (raw.field === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(raw.value)) ||
        (raw.field === "kickoff_time" && !/^\d{2}:\d{2}$/.test(raw.value))) return null;
    return { type: raw.type, field: raw.field, value: raw.value.trim(), previous: match[raw.field] };
  }
  if (raw.type === "team_setting" && ["name", "coed", "min_girls_on_field"].includes(raw.field)) {
    const valid = raw.field === "name" ? short(raw.value) : raw.field === "coed" ? typeof raw.value === "boolean" : integer(raw.value, 1, 11);
    return valid ? { type: raw.type, field: raw.field, value: raw.value, previous: team[raw.field] } : null;
  }
  if (raw.type === "app_setting" && ["field_locked", "reduced_motion", "alert_sound_enabled"].includes(raw.field) && typeof raw.value === "boolean") {
    return { type: raw.type, field: raw.field, value: raw.value, previous: context.app_settings?.[raw.field] };
  }
  if (raw.type === "player_update" && player && ["name", "jersey_number", "availability", "notes", "preferred_groups", "gender"].includes(raw.field)) {
    const valid = raw.field === "name" ? short(raw.value) : raw.field === "jersey_number" ? integer(raw.value, 0, 999) :
      raw.field === "availability" ? ["active", "unavailable"].includes(raw.value) :
      raw.field === "notes" ? typeof raw.value === "string" && raw.value.length <= 500 :
      raw.field === "preferred_groups" ? Array.isArray(raw.value) && raw.value.length > 0 && raw.value.every((item) => GROUPS.includes(item)) :
      ["girl", "boy", null].includes(raw.value);
    return valid ? { type: raw.type, player_id: player.id, field: raw.field, value: raw.value,
      previous: player[raw.field] } : null;
  }
  if (raw.type === "player_create" && short(raw.name) && Array.isArray(raw.preferred_groups) &&
      raw.preferred_groups.length > 0 && raw.preferred_groups.every((item) => GROUPS.includes(item)) &&
      (raw.jersey_number == null || integer(raw.jersey_number, 0, 999)) &&
      (raw.gender == null || ["girl", "boy"].includes(raw.gender)) &&
      (raw.availability == null || ["active", "unavailable"].includes(raw.availability)) &&
      (raw.notes == null || typeof raw.notes === "string" && raw.notes.length <= 500)) {
    return { type: raw.type, name: raw.name.trim(), preferred_groups: [...new Set(raw.preferred_groups)],
      jersey_number: raw.jersey_number ?? null, gender: raw.gender ?? null,
      availability: raw.availability ?? "active", notes: raw.notes ?? "", previous: null };
  }
  if (raw.type === "player_delete" && player) {
    return { type: raw.type, player_id: player.id, previous: { name: player.name, jersey_number: player.jersey_number } };
  }
  if (raw.type === "roster_member" && player && typeof raw.in_match === "boolean") {
    return { type: raw.type, player_id: player.id, in_match: raw.in_match,
      previous: (context.included_player_ids || match.roster_player_ids || []).includes(player.id) };
  }
  if (raw.type === "formation" && typeof raw.formation_id === "string" &&
      (context.formations || []).some((item) => item.id === raw.formation_id && item.format === settings.format)) {
    return { type: raw.type, formation_id: raw.formation_id, previous: settings.formation_id };
  }
  if (raw.type === "lineup_assignment" && player && typeof raw.position_id === "string" &&
      (context.positions || []).some((item) => item.id === raw.position_id)) {
    return { type: raw.type, player_id: player.id, position_id: raw.position_id,
      previous: context.assignments?.[raw.position_id] || null };
  }
  if (raw.type === "lineup_bench" && player) {
    const position = Object.entries(context.assignments || {}).find(([, id]) => id === player.id)?.[0];
    return position ? { type: raw.type, player_id: player.id, position_id: position, previous: player.id } : null;
  }
  if (raw.type === "saved_lineup" && typeof raw.lineup_id === "string" &&
      lineups.some((item) => item.id === raw.lineup_id && item.team_id === match.team_id) &&
      (raw.field === "name" ? short(raw.value) : raw.field === "assignment" &&
        (context.positions || []).some((item) => item.id === raw.position_id) && player)) {
    const lineup = lineups.find((item) => item.id === raw.lineup_id);
    return { type: raw.type, lineup_id: lineup.id, field: raw.field,
      value: raw.field === "name" ? raw.value.trim() : player.id,
      position_id: raw.field === "assignment" ? raw.position_id : undefined,
      previous: raw.field === "name" ? lineup.name : lineup.assignments?.[raw.position_id] || null };
  }
  if (raw.type === "saved_lineup_create" && short(raw.name) && context.current_formation_id && settings.format) {
    return { type: raw.type, name: raw.name.trim(), previous: {
      formation_id: context.current_formation_id, assignments: context.assignments || {},
    } };
  }
  if (raw.type === "saved_lineup_delete" && typeof raw.lineup_id === "string" &&
      lineups.some((item) => item.id === raw.lineup_id && item.team_id === match.team_id)) {
    const lineup = lineups.find((item) => item.id === raw.lineup_id);
    return { type: raw.type, lineup_id: raw.lineup_id, previous: { id: lineup.id, name: lineup.name } };
  }
  return null;
}

export function directAssistantAction(question, context) {
  if (/\?|^\s*(?:what|how|why|when|who|which|should|can|could|would|is|are)\b/i.test(question)) return null;
  const minutes = /\b(?:set|change|make|update|raise|lower)\b.*?\b(?:minimum playing time|playing time minimum|minimum minutes|playing time threshold)\b.*?\b(?:to\s+)?(\d{1,3})\s*(?:minutes?|mins?)?\b/i.exec(question) ||
    /\b(?:set|change|make|update)\b.*?\b(?:minimum playing time|playing time minimum)\b.*?\bto\s+(\d{1,3})\b/i.exec(question);
  if (minutes) return validateAssistantAction({ type: "match_setting", field: "minimum_playing_time_minutes", value: Number(minutes[1]) }, context);
  const timer = /\b(?:set|change|make|update)\b.*?\b(?:auto.?accept|confirmation|assistant)\b.*?\b(?:to\s+)?(\d{1,2})\s*seconds?\b/i.exec(question);
  if (timer) return validateAssistantAction({ type: "match_setting", field: "assistant_accept_seconds", value: Number(timer[1]) }, context);
  return null;
}
