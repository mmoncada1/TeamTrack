def lineup_player(id: str, name: str, jersey: int, groups: list[str], gender: str | None = None) -> Player {
    return Player(id=id, team_id="t", name=name, jersey_number=jersey, preferred_group=groups[0], preferred_groups=groups, gender=gender);
}
test "moves a bench player into an open slot" { assert move_assignment({}, "p1", "mid-c") == {"mid-c": "p1"}; }
test "swaps an assigned player with the target occupant" {
    result = move_assignment({"def-l": "p1", "mid-c": "p2"}, "p1", "mid-c");
    assert result == {"def-l": "p2", "mid-c": "p1"};
}
test "moving to bench removes the assignment" { assert move_assignment({"def-l": "p1"}, "p1", "BENCH") == {}; }
test "auto fill respects preferred positions and jersey order" {
    formation = Formation(id="f", format="7v7", name="test", shape="test", positions=[
        FormationPosition(id="gk", label="GK", group="GK", x=50, y=90), FormationPosition(id="mid", label="MID", group="MID", x=50, y=50)]);
    players = [lineup_player("m2", "Two", 12, ["MID"]), lineup_player("g1", "Keeper", 1, ["GK"]), lineup_player("m1", "One", 8, ["MID"])];
    result = fill_formation(formation, players);
    assert result.assignments == {"gk": "g1", "mid": "m1"};
}
test "coed fill waits for the required girls" {
    formation = Formation(id="f", format="7v7", name="test", shape="test", positions=[FormationPosition(id="mid", label="MID", group="MID", x=50, y=50)]);
    result = fill_formation(formation, [lineup_player("b", "Boy", 1, ["MID"], "boy")], 1);
    assert result.assignments == {};
}
test "coed rule blocks adding a boy before enough girls" {
    players = [lineup_player("b", "Boy", 1, ["MID"], "boy")];
    assert move_breaks_coed_rule(players, {}, {"mid": "b"}, 1);
}

