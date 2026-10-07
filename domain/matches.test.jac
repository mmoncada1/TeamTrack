test "creates a default 7v7 draft" {
    draft = create_draft_match("m1", "t1", "Falcons", "2026-09-30", ["p1", "p2"], 1000);
    assert draft.id == "m1"; assert draft.team_name == "Falcons"; assert draft.settings.format == "7v7";
    assert draft.pending_formation_id == "7v7-2-3-1"; assert draft.roster_player_ids == ["p1", "p2"];
    assert not draft.events; assert draft.created_at == 1000;
}
test "requires opponent and match date" {
    result = validate_match_setup("Falcons", "", "", "7v7", "7v7-2-3-1", 25, 2, [], {});
    assert result.is_blocking; assert "Opponent name is required." in result.errors; assert "Match date is required." in result.errors;
}
test "rejects a formation from another format" {
    result = validate_match_setup("Falcons", "Tigers", "2026-09-30", "7v7", "9v9-3-3-2", 25, 2, [], {});
    assert result.is_blocking; assert "Formation does not match the selected format." in result.errors;
}
test "warns when the starting field is short" {
    result = validate_match_setup("Falcons", "Tigers", "2026-09-30", "7v7", "7v7-2-3-1", 25, 2,
        ["p1", "p2"], {"gk": "p1", "mid-c": "p2"});
    assert not result.is_blocking; assert len(result.warnings) == 1; assert "2 of 7" in result.warnings[0];
}
test "rejects assignments outside the selected roster" {
    result = validate_match_setup("Falcons", "Tigers", "2026-09-30", "7v7", "7v7-2-3-1", 25, 2,
        ["p1"], {"gk": "p2"});
    assert result.is_blocking; assert "not selected" in result.errors[0];
}

