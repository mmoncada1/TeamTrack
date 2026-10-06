def sample_player(id: str, name: str, jersey: int | None) -> Player {
    return Player(id=id, team_id="team-1", name=name, jersey_number=jersey, preferred_group="MID", preferred_groups=["MID"]);
}
test "clamps coed minimum to supported range" { assert clamp_min_girls(None) == 2; assert clamp_min_girls(0) == 1; assert clamp_min_girls(5) == 5; assert clamp_min_girls(20) == 11; }
test "normalizes position groups in selected order" { assert normalize_position_groups(["MID", "MID", "bogus", "DEF"]) == ["MID", "DEF"]; assert position_names(["GK", "FWD"]) == "Goalkeeper, Forward"; }
test "requires core player fields" {
    errors = validate_player(" ", None, [], None, True, []); assert len(errors) == 3;
    assert errors[0].field == "name"; assert errors[1].field == "preferredGroup"; assert errors[2].field == "gender";
}
test "rejects duplicate and negative jersey numbers" {
    existing = [sample_player("p1", "Alex", 8)]; duplicate = validate_player("Sam", 8, ["MID"], None, False, existing);
    assert len(duplicate) == 1; assert "Alex" in duplicate[0].message;
    negative = validate_player("Sam", -1, ["MID"], None, False, []); assert len(negative) == 1; assert negative[0].field == "jerseyNumber";
}
test "allows an edited player to retain a jersey number" { existing = [sample_player("p1", "Alex", 8)]; assert not validate_player("Alex", 8, ["MID"], None, False, existing, "p1"); }
test "sorts jersey numbers first and unnumbered players last" {
    players = [sample_player("p1", "Zoe", None), sample_player("p2", "Ben", 12), sample_player("p3", "Ana", 4), sample_player("p4", "Amy", None)];
    assert [player.name for player in sort_players(players)] == ["Ana", "Ben", "Amy", "Zoe"];
}

