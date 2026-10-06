"""Validate Jac backups before replacing browser data."""

glob WHITEBOARD_PREFIX = "teamtrack:whiteboard:";

def:pub validate_backup(candidate: any) -> list[str] {
    errors: list[str] = [];
    if not isinstance(candidate, dict) { return ["The backup must contain a JSON object."]; }
    if "schemaVersion" not in candidate or candidate["schemaVersion"] != 1 { errors.append("Unsupported or missing backup schema version."); }
    if "data" not in candidate or not isinstance(candidate["data"], dict) { return errors + ["The backup is missing its data section."]; }
    data = candidate["data"];
    for key in ["teams", "players", "lineups", "matches"] {
        if key not in data or not isinstance(data[key], list) { errors.append("The " + key + " collection is missing or invalid."); }
    }
    for key in ["footballFormations", "footballPlays", "drivePlans", "footballWhiteboards"] {
        if key in data and not isinstance(data[key], list) { errors.append("The " + key + " collection is invalid."); }
    }
    if errors { return errors; }
    if not data["teams"] { errors.append("The backup must contain at least one team."); }
    team_ids: list[str] = []; football_team_ids: list[str] = [];
    for team in data["teams"] {
        if not isinstance(team, dict) or not isinstance(team.get("id"), str) or not team["id"] or not isinstance(team.get("name"), str) or not team["name"].strip() {
            errors.append("Every team needs an id and name."); continue;
        }
        if team["id"] in team_ids { errors.append("Duplicate team id in backup."); }
        team_ids.append(team["id"]);
        if team.get("sport") == "football" { football_team_ids.append(team["id"]); }
        elif team.get("sport") not in [None, "soccer"] { errors.append("Unsupported team sport in backup."); }
    }
    player_ids: list[str] = []; player_team: dict[str, str] = {};
    for player in data["players"] {
        if not isinstance(player, dict) or not isinstance(player.get("id"), str) or not player["id"] or not isinstance(player.get("name"), str) or not player["name"].strip() or player.get("team_id") not in team_ids or player.get("preferred_group") not in ["GK", "DEF", "MID", "FWD"] {
            errors.append("A player has invalid identity, team, name, or position."); continue;
        }
        if player["id"] in player_ids { errors.append("Duplicate player id in backup."); }
        player_ids.append(player["id"]); player_team[player["id"]] = player["team_id"];
    }
    lineup_ids: list[str] = [];
    for lineup in data["lineups"] {
        if not isinstance(lineup, dict) or not isinstance(lineup.get("id"), str) or not lineup["id"] or lineup.get("team_id") not in team_ids or not isinstance(lineup.get("name"), str) or not isinstance(lineup.get("assignments"), dict) {
            errors.append("A saved lineup is invalid or refers to a missing team."); continue;
        }
        if lineup["id"] in lineup_ids { errors.append("Duplicate lineup id in backup."); }
        lineup_ids.append(lineup["id"]);
        for assigned_id in lineup["assignments"].values() {
            if assigned_id in player_team and player_team[assigned_id] != lineup["team_id"] { errors.append("A lineup assigns a player from another team."); break; }
        }
    }
    match_ids: list[str] = [];
    for game in data["matches"] {
        if not isinstance(game, dict) or not isinstance(game.get("id"), str) or not game["id"] or game.get("team_id") not in team_ids or not isinstance(game.get("settings"), dict) or not isinstance(game.get("events"), list) or not isinstance(game.get("roster_player_ids"), list) {
            errors.append("A match is invalid or refers to a missing team."); continue;
        }
        if game["id"] in match_ids { errors.append("Duplicate match id in backup."); }
        match_ids.append(game["id"]);
        match_settings = game["settings"];
        if match_settings.get("format") not in ["7v7", "9v9", "11v11"] or not isinstance(match_settings.get("formation_id"), str) or not isinstance(match_settings.get("thresholds"), dict) or not isinstance(match_settings.get("half_length_minutes"), int) or not isinstance(match_settings.get("number_of_halves"), int) {
            errors.append("A match has invalid settings.");
        }
        for player_id in game["roster_player_ids"] {
            if player_id in player_team and player_team[player_id] != game["team_id"] { errors.append("A match includes a player from another team."); break; }
        }
        for event in game["events"] {
            if not isinstance(event, dict) or not isinstance(event.get("id"), str) or not isinstance(event.get("type"), str) or not isinstance(event.get("match_clock_ms"), int) or not isinstance(event.get("data"), dict) {
                errors.append("A match contains an invalid event."); break;
            }
        }
    }
    football_ids: list[str] = [];
    for key in ["footballFormations", "footballPlays", "drivePlans", "footballWhiteboards"] {
        for item in data.get(key, []) {
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"] or item.get("team_id") not in football_team_ids {
                errors.append("A football record is invalid or belongs to a non-football team."); continue;
            }
            if item["id"] in football_ids { errors.append("Duplicate football record id in backup."); }
            football_ids.append(item["id"]);
        }
    }
    if "activeTeamId" not in data or not isinstance(data["activeTeamId"], str) { errors.append("The active team id is missing or invalid."); }
    elif data["activeTeamId"] not in team_ids { errors.append("The active team does not exist in the teams collection."); }
    if "appSettings" not in data or not isinstance(data["appSettings"], dict) { errors.append("App settings are missing or invalid."); }
    if "whiteboards" not in data or not isinstance(data["whiteboards"], dict) { errors.append("Whiteboard data is missing or invalid."); }
    elif any([not str(key).startswith(WHITEBOARD_PREFIX) for key in data["whiteboards"].keys()]) { errors.append("The backup contains an invalid whiteboard key."); }
    return errors;
}
