"""Validate Jac backups before replacing browser data."""

glob WHITEBOARD_PREFIX = "teamtrack:whiteboard:";

def is_json_object(value: any) -> bool {
    if isinstance(value, dict) { return True; }
    try { return value is not None and value.constructor == Object; }
    except Exception { return False; }
}

def:pub validate_backup(candidate: any) -> list[str] {
    errors: list[str] = [];
    if not is_json_object(candidate) { return ["The backup must contain a JSON object."]; }
    if "schemaVersion" not in candidate or candidate["schemaVersion"] != 1 { errors.append("Unsupported or missing backup schema version."); }
    if "data" not in candidate or not is_json_object(candidate["data"]) { return errors + ["The backup is missing its data section."]; }
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
        if not is_json_object(team) or not isinstance(team.get("id"), str) or not team["id"] or not isinstance(team.get("name"), str) or not team["name"].strip() {
            errors.append("Every team needs an id and name."); continue;
        }
        if team["id"] in team_ids { errors.append("Duplicate team id in backup."); }
        team_ids.append(team["id"]);
        if team.get("sport") == "football" { football_team_ids.append(team["id"]); }
        elif team.get("sport") not in [None, "soccer"] { errors.append("Unsupported team sport in backup."); }
    }
    player_ids: list[str] = []; player_team: dict[str, str] = {};
    for player in data["players"] {
        if not is_json_object(player) or not isinstance(player.get("id"), str) or not player["id"] or not isinstance(player.get("name"), str) or not player["name"].strip() or player.get("team_id") not in team_ids or player.get("preferred_group") not in ["GK", "DEF", "MID", "FWD"] {
            errors.append("A player has invalid identity, team, name, or position."); continue;
        }
        if player["id"] in player_ids { errors.append("Duplicate player id in backup."); }
        player_ids.append(player["id"]); player_team[player["id"]] = player["team_id"];
    }
    lineup_ids: list[str] = [];
    for lineup in data["lineups"] {
        if not is_json_object(lineup) or not isinstance(lineup.get("id"), str) or not lineup["id"] or lineup.get("team_id") not in team_ids or not isinstance(lineup.get("name"), str) or not is_json_object(lineup.get("assignments")) {
            errors.append("A saved lineup is invalid or refers to a missing team."); continue;
        }
        if lineup["id"] in lineup_ids { errors.append("Duplicate lineup id in backup."); }
        lineup_ids.append(lineup["id"]);
        if lineup["team_id"] in football_team_ids { errors.append("A soccer lineup belongs to a football team."); }
        for assigned_id in lineup["assignments"].values() {
            if assigned_id in player_team and player_team[assigned_id] != lineup["team_id"] { errors.append("A lineup assigns a player from another team."); break; }
        }
    }
    match_ids: list[str] = [];
    for game in data["matches"] {
        if not is_json_object(game) or not isinstance(game.get("id"), str) or not game["id"] or game.get("team_id") not in team_ids or not is_json_object(game.get("settings")) or not isinstance(game.get("events"), list) or not isinstance(game.get("roster_player_ids"), list) {
            errors.append("A match is invalid or refers to a missing team."); continue;
        }
        if game["id"] in match_ids { errors.append("Duplicate match id in backup."); }
        match_ids.append(game["id"]);
        if game["team_id"] in football_team_ids { errors.append("A soccer match belongs to a football team."); }
        match_settings = game["settings"];
        if match_settings.get("format") not in ["7v7", "9v9", "11v11"] or not isinstance(match_settings.get("formation_id"), str) or not is_json_object(match_settings.get("thresholds")) or not isinstance(match_settings.get("half_length_minutes"), int) or not isinstance(match_settings.get("number_of_halves"), int) {
            errors.append("A match has invalid settings.");
        }
        for player_id in game["roster_player_ids"] {
            if player_id in player_team and player_team[player_id] != game["team_id"] { errors.append("A match includes a player from another team."); break; }
        }
        for event in game["events"] {
            if not is_json_object(event) or not isinstance(event.get("id"), str) or not isinstance(event.get("type"), str) or not isinstance(event.get("match_clock_ms"), int) or not is_json_object(event.get("data")) {
                errors.append("A match contains an invalid event."); break;
            }
        }
    }
    football_ids: list[str] = [];
    for key in ["footballFormations", "footballPlays", "drivePlans", "footballWhiteboards"] {
        for item in data.get(key, []) {
            if not is_json_object(item) or not isinstance(item.get("id"), str) or not item["id"] or item.get("team_id") not in football_team_ids {
                errors.append("A football record is invalid or belongs to a non-football team."); continue;
            }
            if item["id"] in football_ids { errors.append("Duplicate football record id in backup."); }
            football_ids.append(item["id"]);
        }
    }
    play_team: dict[str, str] = {};
    for key in ["footballFormations", "footballPlays"] {
        for item in data.get(key, []) {
            if not is_json_object(item) or item.get("team_id") not in football_team_ids { continue; }
            slots = item.get("players");
            if not isinstance(slots, list) or len(slots) != 7 { errors.append("A football formation or play must have seven slots."); continue; }
            slot_ids: list[str] = [];
            for slot in slots {
                if not is_json_object(slot) or not isinstance(slot.get("id"), str) or not slot["id"] or not isinstance(slot.get("label"), str) or not is_json_object(slot.get("position")) or not is_json_object(slot.get("route")) {
                    errors.append("A football player slot is invalid."); continue;
                }
                if slot["id"] in slot_ids { errors.append("Duplicate football player slot id."); }
                slot_ids.append(slot["id"]);
                assigned_id = slot.get("roster_player_id");
                if assigned_id is not None and (not isinstance(assigned_id, str) or player_team.get(assigned_id) != item["team_id"]) { errors.append("A football slot assigns a player from another team or a missing player."); }
            }
            if item.get("quarterback_id") not in slot_ids or item.get("snapper_id") not in slot_ids or item.get("quarterback_id") == item.get("snapper_id") { errors.append("A football record has invalid QB or snapper roles."); }
            if key == "footballPlays" {
                if isinstance(item.get("id"), str) { play_team[item["id"]] = item["team_id"]; }
                if not isinstance(item.get("ball_actions"), list) or not isinstance(item.get("drawings"), list) or not isinstance(item.get("tags"), list) { errors.append("A football play has invalid actions, drawings, or tags."); }
            }
        }
    }
    for drive in data.get("drivePlans", []) {
        if not is_json_object(drive) or drive.get("team_id") not in football_team_ids { continue; }
        if not isinstance(drive.get("entries"), list) { errors.append("A drive has invalid entries."); continue; }
        for call in drive["entries"] {
            if not is_json_object(call) or not isinstance(call.get("id"), str) or not isinstance(call.get("play_id"), str) or play_team.get(call.get("play_id")) != drive["team_id"] { errors.append("A drive refers to a missing or cross-team play."); }
        }
    }
    for board in data.get("footballWhiteboards", []) {
        if is_json_object(board) and not isinstance(board.get("drawings"), list) { errors.append("A football whiteboard has invalid drawings."); }
    }
    if "activeTeamId" not in data or not isinstance(data["activeTeamId"], str) { errors.append("The active team id is missing or invalid."); }
    elif data["activeTeamId"] not in team_ids { errors.append("The active team does not exist in the teams collection."); }
    if "appSettings" not in data or not is_json_object(data["appSettings"]) { errors.append("App settings are missing or invalid."); }
    if "whiteboards" not in data or not is_json_object(data["whiteboards"]) { errors.append("Whiteboard data is missing or invalid."); }
    elif any([not str(key).startswith(WHITEBOARD_PREFIX) for key in data["whiteboards"].keys()]) { errors.append("The backup contains an invalid whiteboard key."); }
    return errors;
}
