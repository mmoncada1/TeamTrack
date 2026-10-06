def sample_backup() -> dict[str, any] {
    return {"schemaVersion": 1, "data": {
        "teams": [{"id": "team-1", "name": "Soccer"}],
        "players": [{"id": "player-1", "team_id": "team-1", "name": "Alex", "preferred_group": "GK"}],
        "lineups": [{"id": "lineup-1", "team_id": "team-1", "name": "Start", "assignments": {"GK": "player-1"}}],
        "matches": [{"id": "match-1", "team_id": "team-1", "roster_player_ids": ["player-1"], "events": [],
            "settings": {"format": "7v7", "formation_id": "7v7-2-3-1", "thresholds": {}, "half_length_minutes": 25, "number_of_halves": 2}}],
        "activeTeamId": "team-1", "appSettings": {}, "whiteboards": {}
    }};
}

test "accepts a valid backup and historical player references" {
    backup = sample_backup(); assert not validate_backup(backup);
    backup["data"]["players"] = [];
    assert not validate_backup(backup);
}

test "rejects cross-team references before restore" {
    backup = sample_backup(); backup["data"]["teams"].append({"id": "team-2", "name": "Other"});
    backup["data"]["players"][0]["team_id"] = "team-2";
    errors = validate_backup(backup);
    assert any(["another team" in error for error in errors]);
}

test "rejects duplicate ids and malformed match events" {
    backup = sample_backup(); backup["data"]["teams"].append({"id": "team-1", "name": "Duplicate"});
    backup["data"]["matches"][0]["events"] = [{"id": "bad", "type": "GOAL"}];
    errors = validate_backup(backup);
    assert any(["Duplicate team" in error for error in errors]);
    assert any(["invalid event" in error for error in errors]);
}

test "keeps old soccer backups compatible and rejects football data on soccer teams" {
    backup = sample_backup(); assert not validate_backup(backup);
    backup["data"]["footballFormations"] = [{"id": "formation-1", "team_id": "team-1"}];
    assert any(["non-football" in error for error in validate_backup(backup)]);
}
