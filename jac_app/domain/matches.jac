"""Pure draft-match creation and setup validation."""
import from .models { Match, MatchSettings, ThresholdSetting }
import from .formations { formation_by_id }
import from .roster { clamp_min_girls }

obj SetupValidation {
    has errors: list[str] = [], warnings: list[str] = [], is_blocking: bool = False;
}

def:pub standard_thresholds() -> dict[str, ThresholdSetting] {
    return {"GK": ThresholdSetting(enabled=False, minutes=10), "DEF": ThresholdSetting(enabled=True, minutes=5),
        "MID": ThresholdSetting(enabled=True, minutes=4), "FWD": ThresholdSetting(enabled=True, minutes=5)};
}

def:pub create_draft_match(id: str, team_id: str, team_name: str, date: str,
    roster_player_ids: list[str], now_ms: int) -> Match {
    return Match(id=id, team_id=team_id, team_name=team_name, opponent_name="", date=date,
        settings=MatchSettings(format="7v7", formation_id="7v7-2-3-1", half_length_minutes=25,
            number_of_halves=2, thresholds=standard_thresholds()),
        roster_player_ids=roster_player_ids, unavailable_player_ids=[], pending_assignments={},
        pending_formation_id="7v7-2-3-1", events=[], active_alerts=[], created_at=now_ms, updated_at=now_ms);
}

def:pub validate_match_setup(team_name: str, opponent_name: str, date: str, format: str,
    formation_id: str, half_length_minutes: int, number_of_halves: int,
    roster_player_ids: list[str], assignments: dict[str, str]) -> SetupValidation {
    errors: list[str] = []; warnings: list[str] = [];
    if not team_name.strip() { errors.append("Team name is required."); }
    if not opponent_name.strip() { errors.append("Opponent name is required."); }
    if not date { errors.append("Match date is required."); }
    if format not in ["7v7", "9v9", "11v11"] { errors.append("Select a valid match format."); }
    formation = formation_by_id(formation_id);
    if formation is None { errors.append("Select a valid formation."); }
    elif formation.format != format { errors.append("Formation does not match the selected format."); }
    if half_length_minutes <= 0 { errors.append("Half length must be a positive number of minutes."); }
    if number_of_halves not in [1, 2] { errors.append("Number of halves must be 1 or 2."); }
    max_players = 7 if format == "7v7" else 9 if format == "9v9" else 11;
    if len(assignments) > max_players { errors.append(f"Too many players assigned to the field: {len(assignments)} assigned, but {format} allows {max_players}."); }
    assigned_ids = list(assignments.values());
    if len(set(assigned_ids)) != len(assigned_ids) { errors.append("A player is assigned to multiple positions."); }
    for player_id in assigned_ids {
        if player_id not in roster_player_ids { errors.append("A field assignment includes a player who is not selected for this match."); break; }
    }
    if len(assignments) == 0 { warnings.append("No players are assigned to the field yet."); }
    elif len(assignments) < max_players { warnings.append(f"Only {len(assignments)} of {max_players} field positions are filled. The team will be short-handed."); }
    return SetupValidation(errors=errors, warnings=warnings, is_blocking=bool(errors));
}

