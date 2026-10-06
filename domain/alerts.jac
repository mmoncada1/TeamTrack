"""Playing-time alert lifecycle and collision-free incoming recommendations."""

import from .models { Alert, Player, FormationPosition, ThresholdSetting }
import from .live_match { PlayerRuntimeState }
import from .formations { formation_by_id }
import from .recommendations { RecommendationContext, recommend_incoming_player, player_by_id }

obj UpdateAlertsResult {
    has alerts: list[Alert], new_alert_ids: list[str];
}

def girls_on_field(players: list[Player], states: dict[str, PlayerRuntimeState]) -> int {
    count = 0;
    for state in states.values() {
        player = player_by_id(players, state.player_id);
        if state.status == "field" and player is not None and player.gender == "girl" { count += 1; }
    }
    return count;
}

def should_prefer_girl(min_girls_on_field: int | None, girls_count: int,
    outgoing_gender: str | None) -> bool {
    if min_girls_on_field is None { return False; }
    return girls_count < min_girls_on_field or (girls_count == min_girls_on_field and outgoing_gender == "girl");
}

def alert_recommendation(position_id: str | None, outgoing_player_id: str,
    players: list[Player], player_states: dict[str, PlayerRuntimeState],
    thresholds: dict[str, ThresholdSetting], goalkeeper_rotation_enabled: bool,
    positions: list[FormationPosition], roster_order: list[str], claimed: list[str],
    min_girls_on_field: int | None, girls_count: int) -> dict[str, str] | None {
    if position_id is None { return None; }
    outgoing = player_by_id(players, outgoing_player_id);
    outgoing_gender = outgoing.gender if outgoing is not None else None;
    prefer = "girl" if should_prefer_girl(min_girls_on_field, girls_count, outgoing_gender) else None;
    recommendation = recommend_incoming_player(position_id, RecommendationContext(
        players=players, player_states=player_states, thresholds=thresholds,
        goalkeeper_rotation_enabled=goalkeeper_rotation_enabled, roster_order=roster_order,
        positions=positions, exclude_player_ids=claimed, prefer_gender=prefer));
    if recommendation is None { return None; }
    claimed.append(recommendation.player_id);
    return {"in_player_id": recommendation.player_id, "explanation": recommendation.explanation};
}

def:pub update_alerts(existing_alerts: list[Alert],
    player_states: dict[str, PlayerRuntimeState], players: list[Player],
    thresholds: dict[str, ThresholdSetting], goalkeeper_rotation_enabled: bool,
    positions: list[FormationPosition], roster_order: list[str], match_clock_ms: int,
    min_girls_on_field: int | None = None) -> UpdateAlertsResult {
    result: list[Alert] = []; new_ids: list[str] = []; claimed: list[str] = [];
    girls_count = girls_on_field(players, player_states);
    for alert in existing_alerts {
        if alert.status == "resolved" or alert.player_id not in player_states { continue; }
        state = player_states[alert.player_id];
        if state.status != "field" or state.current_stint_start_ms != alert.stint_start_ms { continue; }
        if alert.status == "dismissed" { result.append(alert); continue; }
        status = "active" if alert.status == "snoozed" and alert.snooze_until_clock_ms is not None
            and match_clock_ms >= alert.snooze_until_clock_ms else alert.status;
        result.append(Alert(id=alert.id, player_id=alert.player_id,
            position_group=alert.position_group, threshold_minutes=alert.threshold_minutes,
            stint_start_ms=alert.stint_start_ms, created_at_clock_ms=alert.created_at_clock_ms,
            status=status, snooze_until_clock_ms=alert.snooze_until_clock_ms,
            recommendation=alert_recommendation(state.position_id, alert.player_id, players,
                player_states, thresholds, goalkeeper_rotation_enabled, positions, roster_order,
                claimed, min_girls_on_field, girls_count)));
    }
    keys = [f"{alert.player_id}:{alert.stint_start_ms}" for alert in result];
    for state in player_states.values() {
        if state.status != "field" or state.position_id is None or state.position_group is None { continue; }
        if state.position_group == "GK" and not goalkeeper_rotation_enabled { continue; }
        if player_by_id(players, state.player_id) is None or state.position_group not in thresholds { continue; }
        threshold = thresholds[state.position_group];
        if not threshold.enabled or state.current_stint_ms < threshold.minutes * 60_000 or state.current_stint_start_ms is None { continue; }
        key = f"{state.player_id}:{state.current_stint_start_ms}";
        if key in keys { continue; }
        alert_id = f"alert-{state.player_id}-{state.current_stint_start_ms}";
        result.append(Alert(id=alert_id, player_id=state.player_id,
            position_group=state.position_group, threshold_minutes=threshold.minutes,
            stint_start_ms=state.current_stint_start_ms, created_at_clock_ms=match_clock_ms,
            status="active", recommendation=alert_recommendation(state.position_id, state.player_id,
                players, player_states, thresholds, goalkeeper_rotation_enabled, positions,
                roster_order, claimed, min_girls_on_field, girls_count)));
        new_ids.append(alert_id); keys.append(key);
    }
    return UpdateAlertsResult(alerts=result, new_alert_ids=new_ids);
}

def:pub dismiss_alert(alerts: list[Alert], alert_id: str, action: str,
    match_clock_ms: int, snooze_minutes: int = 3) -> list[Alert] {
    result: list[Alert] = []; found = False;
    for alert in alerts {
        if alert.id != alert_id { result.append(alert); continue; }
        found = True;
        status = "dismissed" if action == "dismiss" else "snoozed";
        snooze_until = None if action == "dismiss" else match_clock_ms + snooze_minutes * 60_000;
        result.append(Alert(id=alert.id, player_id=alert.player_id,
            position_group=alert.position_group, threshold_minutes=alert.threshold_minutes,
            stint_start_ms=alert.stint_start_ms, created_at_clock_ms=alert.created_at_clock_ms,
            status=status, snooze_until_clock_ms=snooze_until,
            recommendation=None if action == "dismiss" else alert.recommendation));
    }
    if not found { raise ValueError("Alert not found."); }
    return result;
}
