def rec_player(id: str, name: str, group: str, gender: str | None = None) -> Player {
    return Player(id=id, team_id="t1", name=name, preferred_group=group,
        preferred_groups=[group], gender=gender, availability="active");
}

def rec_state(id: str, status: str, position_id: str | None, group: str | None,
    stint_ms: int, field_ms: int = 0) -> PlayerRuntimeState {
    return PlayerRuntimeState(player_id=id, status=status, position_id=position_id,
        position_group=group, intervals=[], current_stint_start_ms=0,
        current_stint_ms=stint_ms, total_field_ms=field_ms,
        total_bench_ms=stint_ms if status == "bench" else 0);
}

def rec_thresholds() -> dict[str, ThresholdSetting] {
    return {"GK": ThresholdSetting(enabled=True, minutes=5), "DEF": ThresholdSetting(enabled=True, minutes=5),
        "MID": ThresholdSetting(enabled=True, minutes=4), "FWD": ThresholdSetting(enabled=True, minutes=5)};
}

def rec_positions() -> list[FormationPosition] { formation = formation_by_id("7v7-2-3-1"); if formation is None { return []; } return formation.positions; }

test "ranks the most overdue outgoing player first" {
    players = [rec_player("mid", "Mid", "MID"), rec_player("def", "Def", "DEF")];
    states = {"mid": rec_state("mid", "field", "mid-c", "MID", 360_000),
        "def": rec_state("def", "field", "def-l", "DEF", 720_000)};
    found = find_exceeded_outgoing_candidates(RecommendationContext(players=players, player_states=states,
        thresholds=rec_thresholds(), goalkeeper_rotation_enabled=False,
        roster_order=["mid", "def"], positions=rec_positions()));
    assert len(found) == 2; assert found[0].player_id == "def"; assert found[0].overage_ms == 420_000;
}

test "goalkeepers require rotation enabled" {
    players = [rec_player("gk", "Goalie", "GK")]; states = {"gk": rec_state("gk", "field", "gk", "GK", 600_000)};
    context = RecommendationContext(players=players, player_states=states, thresholds=rec_thresholds(),
        goalkeeper_rotation_enabled=False, roster_order=["gk"], positions=rec_positions());
    assert not find_exceeded_outgoing_candidates(context);
    context.goalkeeper_rotation_enabled = True; assert len(find_exceeded_outgoing_candidates(context)) == 1;
}

test "matching position outranks longer bench stint" {
    players = [rec_player("matching", "Matching", "MID"), rec_player("other", "Other", "FWD")];
    states = {"matching": rec_state("matching", "bench", None, None, 120_000),
        "other": rec_state("other", "bench", None, None, 600_000)};
    result = recommend_incoming_player("mid-c", RecommendationContext(players=players, player_states=states,
        thresholds=rec_thresholds(), goalkeeper_rotation_enabled=False,
        roster_order=["matching", "other"], positions=rec_positions()));
    assert result is not None; assert result.player_id == "matching"; assert "matches the center midfield role" in result.explanation;
}

test "incoming tie breaks use bench time field time then roster order" {
    players = [rec_player("a", "A", "MID"), rec_player("b", "B", "MID"), rec_player("c", "C", "MID")];
    states = {"a": rec_state("a", "bench", None, None, 300_000, 100_000),
        "b": rec_state("b", "bench", None, None, 300_000, 80_000),
        "c": rec_state("c", "bench", None, None, 300_000, 80_000)};
    result = recommend_incoming_player("mid-c", RecommendationContext(players=players, player_states=states,
        thresholds=rec_thresholds(), goalkeeper_rotation_enabled=False,
        roster_order=["c", "b", "a"], positions=rec_positions()));
    assert result is not None; assert result.player_id == "c";
}

test "preferred gender outranks position match for coed safety" {
    players = [rec_player("boy", "Boy Mid", "MID", "boy"), rec_player("girl", "Girl Forward", "FWD", "girl")];
    states = {"boy": rec_state("boy", "bench", None, None, 600_000),
        "girl": rec_state("girl", "bench", None, None, 60_000)};
    result = recommend_incoming_player("mid-c", RecommendationContext(players=players, player_states=states,
        thresholds=rec_thresholds(), goalkeeper_rotation_enabled=False,
        roster_order=["boy", "girl"], positions=rec_positions(), prefer_gender="girl"));
    assert result is not None; assert result.player_id == "girl"; assert "keeps a girl" in result.explanation;
}

test "exclusions prevent duplicate recommendations" {
    players = [rec_player("a", "A", "MID"), rec_player("b", "B", "MID")];
    states = {"a": rec_state("a", "bench", None, None, 500_000), "b": rec_state("b", "bench", None, None, 300_000)};
    context = RecommendationContext(players=players, player_states=states, thresholds=rec_thresholds(),
        goalkeeper_rotation_enabled=False, roster_order=["a", "b"], positions=rec_positions(), exclude_player_ids=["a"]);
    result = recommend_incoming_player("mid-c", context); assert result is not None; assert result.player_id == "b";
}

test "full substitution combines outgoing and incoming names" {
    players = [rec_player("out", "Jordan", "MID"), rec_player("in", "Maya", "MID")];
    states = {"out": rec_state("out", "field", "mid-c", "MID", 600_000, 600_000),
        "in": rec_state("in", "bench", None, None, 360_000)};
    result = recommend_substitution(RecommendationContext(players=players, player_states=states,
        thresholds=rec_thresholds(), goalkeeper_rotation_enabled=False,
        roster_order=["out", "in"], positions=rec_positions()));
    assert result is not None; assert result.outgoing_player_id == "out"; assert result.incoming_player_id == "in";
    assert "Maya" in result.explanation; assert "Jordan" in result.explanation;
}
