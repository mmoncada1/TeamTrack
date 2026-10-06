def alert_player(id: str, name: str, group: str, gender: str | None = None) -> Player {
    return Player(id=id, team_id="t1", name=name, preferred_group=group, preferred_groups=[group], gender=gender, availability="active");
}

def alert_state(id: str, status: str, position_id: str | None, group: str | None, stint_ms: int, field_ms: int = 0) -> PlayerRuntimeState {
    return PlayerRuntimeState(player_id=id, status=status, position_id=position_id, position_group=group, intervals=[], current_stint_start_ms=0, current_stint_ms=stint_ms, total_field_ms=field_ms, total_bench_ms=stint_ms if status == "bench" else 0);
}

def alert_thresholds() -> dict[str, ThresholdSetting] {
    return {"GK": ThresholdSetting(enabled=True, minutes=5), "DEF": ThresholdSetting(enabled=True, minutes=5), "MID": ThresholdSetting(enabled=True, minutes=4), "FWD": ThresholdSetting(enabled=True, minutes=5)};
}

def alert_positions() -> list[FormationPosition] {
    formation = formation_by_id("7v7-2-3-1"); if formation is None { return []; } return formation.positions;
}

def alert_context() -> tuple[list[Player], dict[str, PlayerRuntimeState], list[FormationPosition]] {
    players = [alert_player("out-a", "A", "MID"), alert_player("out-b", "B", "MID"),
        alert_player("bench-a", "Bench A", "MID"), alert_player("bench-b", "Bench B", "MID")];
    states = {"out-a": alert_state("out-a", "field", "mid-l", "MID", 360_000, 360_000),
        "out-b": alert_state("out-b", "field", "mid-r", "MID", 360_000, 360_000),
        "bench-a": alert_state("bench-a", "bench", None, None, 600_000),
        "bench-b": alert_state("bench-b", "bench", None, None, 300_000)};
    return (players, states, alert_positions());
}

test "creates one threshold alert per player stint" {
    (players, states, positions) = alert_context();
    first = update_alerts([], states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 360_000);
    assert len(first.alerts) == 2; assert len(first.new_alert_ids) == 2;
    second = update_alerts(first.alerts, states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 361_000);
    assert len(second.alerts) == 2; assert not second.new_alert_ids;
}

test "assigns distinct incoming recommendations in one pass" {
    (players, states, positions) = alert_context();
    result = update_alerts([], states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 360_000);
    first_id = result.alerts[0].recommendation["in_player_id"];
    second_id = result.alerts[1].recommendation["in_player_id"];
    assert first_id != second_id; assert first_id in ["bench-a", "bench-b"]; assert second_id in ["bench-a", "bench-b"];
}

test "dismissed alerts remain deduplicated for their stint" {
    (players, states, positions) = alert_context();
    first = update_alerts([], states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 360_000);
    alerts = dismiss_alert(first.alerts, first.alerts[0].id, "dismiss", 360_000);
    next = update_alerts(alerts, states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 500_000);
    assert len(next.alerts) == 2; assert next.alerts[0].status == "dismissed"; assert not next.new_alert_ids;
}

test "snoozed alerts reactivate when the match clock reaches deadline" {
    (players, states, positions) = alert_context();
    first = update_alerts([], states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 360_000);
    alert_id = first.alerts[0].id; alerts = dismiss_alert(first.alerts, alert_id, "snooze", 360_000, 2);
    before = update_alerts(alerts, states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 479_999);
    assert before.alerts[0].status == "snoozed";
    after = update_alerts(before.alerts, states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 480_000);
    assert after.alerts[0].status == "active";
}

test "alerts resolve when a player leaves the field or starts a new stint" {
    (players, states, positions) = alert_context();
    first = update_alerts([], states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 360_000);
    states["out-a"].status = "bench"; states["out-b"].current_stint_start_ms = 300_000;
    next = update_alerts(first.alerts, states, players, alert_thresholds(), False, positions,
        ["out-a", "out-b", "bench-a", "bench-b"], 500_000);
    assert len(next.alerts) == 1; assert next.alerts[0].player_id == "out-b"; assert len(next.new_alert_ids) == 1;
}

test "coed minimum makes a girl the preferred replacement" {
    players = [alert_player("out", "Outgoing Girl", "MID", "girl"),
        alert_player("boy", "Boy Mid", "MID", "boy"), alert_player("girl", "Girl Forward", "FWD", "girl")];
    states = {"out": alert_state("out", "field", "mid-c", "MID", 360_000, 360_000),
        "boy": alert_state("boy", "bench", None, None, 600_000),
        "girl": alert_state("girl", "bench", None, None, 60_000)};
    result = update_alerts([], states, players, alert_thresholds(), False, alert_positions(),
        ["out", "boy", "girl"], 360_000, 1);
    assert result.alerts[0].recommendation["in_player_id"] == "girl";
}

test "goalkeeper alerts honor rotation setting" {
    players = [alert_player("gk", "Goalie", "GK")]; states = {"gk": alert_state("gk", "field", "gk", "GK", 600_000)};
    off = update_alerts([], states, players, alert_thresholds(), False, alert_positions(), ["gk"], 600_000);
    assert not off.alerts;
    on = update_alerts([], states, players, alert_thresholds(), True, alert_positions(), ["gk"], 600_000);
    assert len(on.alerts) == 1;
}
