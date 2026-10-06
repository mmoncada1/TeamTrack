"""Match summaries and human-readable event labels."""
import from .models { Match, MatchEvent, Player }
import from .live_match { derive_match_state }
import from .timer { format_clock }

obj PlayerSummary {
    has player_id: str,
        player_name: str,
        jersey_number: int | None,
        status: str,
        total_field_ms: int,
        total_bench_ms: int,
        goals: int,
        assists: int,
        subs_in: int,
        subs_out: int;
}

obj MatchSummaryData {
    has summaries: list[PlayerSummary],
        average_field_ms: float,
        below_average_player_ids: list[str],
        team_score: int,
        opponent_score: int,
        match_clock_ms: int;
}

def player_summary_sort(item: PlayerSummary) -> tuple[int, int, str] {
    jersey = item.jersey_number if item.jersey_number is not None else 9999;
    return (-item.total_field_ms, jersey, item.player_name.lower());
}

def:pub build_match_summary(game: Match, players: list[Player], now_ms: int) -> MatchSummaryData {
    derived = derive_match_state(game, now_ms);
    players_by_id = {player.id: player for player in players};
    summaries: list[PlayerSummary] = [];
    for (player_id, runtime) in derived.player_states.items() {
        if player_id not in players_by_id { continue; }
        player = players_by_id[player_id];
        summaries.append(PlayerSummary(
            player_id=player_id, player_name=player.name, jersey_number=player.jersey_number,
            status=runtime.status, total_field_ms=runtime.total_field_ms,
            total_bench_ms=runtime.total_bench_ms, goals=runtime.goals,
            assists=runtime.assists, subs_in=runtime.subs_in, subs_out=runtime.subs_out
        ));
    }
    summaries = sorted(summaries, key=player_summary_sort);
    available = [item for item in summaries if item.status != "unavailable"];
    average = sum([item.total_field_ms for item in available]) / len(available) if available else 0.0;
    below = [item.player_id for item in available if average > 0 and item.total_field_ms < average * 0.7];
    return MatchSummaryData(summaries=summaries, average_field_ms=average,
        below_average_player_ids=below, team_score=derived.team_score,
        opponent_score=derived.opponent_score, match_clock_ms=derived.match_clock_ms);
}

def player_name(players_by_id: dict[str, Player], id: str | None) -> str {
    if id and id in players_by_id { return players_by_id[id].name; }
    return "Unknown player";
}

def:pub describe_event(event: MatchEvent, players: list[Player], formation_id: str = "") -> str {
    players_by_id = {player.id: player for player in players}; data = event.data;
    if event.type == "MATCH_STARTED" { return "Match started."; }
    if event.type == "MATCH_PAUSED" { return "Match paused."; }
    if event.type == "MATCH_RESUMED" { return "Match resumed."; }
    if event.type == "HALF_TIME" { return "Half-time."; }
    if event.type == "SECOND_HALF_STARTED" { return "Second half started."; }
    if event.type == "MATCH_ENDED" { return "Match ended."; }
    if event.type == "FORMATION_CHANGED" { return str(data.get("summary", "Formation changed.")); }
    if event.type == "PLAYER_MOVED" {
        destination = "the bench" if data.get("to_slot") == "BENCH" else str(data.get("to_slot", "position"));
        return player_name(players_by_id, data.get("player_id")) + " moved to " + destination + ".";
    }
    if event.type == "PLAYERS_SWAPPED" {
        return player_name(players_by_id, data.get("player_a_id")) + " and " + player_name(players_by_id, data.get("player_b_id")) + " swapped positions.";
    }
    if event.type == "SUBSTITUTION" {
        return "Substitution: " + player_name(players_by_id, data.get("player_in_id")) + " on for " + player_name(players_by_id, data.get("player_out_id")) + ".";
    }
    if event.type == "GOAL" {
        if data.get("is_own_goal", False) { return "Own goal (against us)."; }
        if data.get("team") == "opponent" { return "Opponent goal."; }
        scorer = player_name(players_by_id, data.get("scorer_id"));
        assist = " (assist: " + player_name(players_by_id, data.get("assister_id")) + ")" if data.get("assister_id") else "";
        return "Goal: " + scorer + assist + ".";
    }
    if event.type == "CARD" {
        name = player_name(players_by_id, data.get("player_id"));
        if data.get("second_yellow", False) { return "Second yellow, sent off: " + name + "."; }
        return ("Red card: " if data.get("color") == "red" else "Yellow card: ") + name + ".";
    }
    if event.type == "NOTE" { return event.note or "Note."; }
    return event.type.replace("_", " ").title() + ".";
}

def:pub event_time_label(event: MatchEvent) -> str { return format_clock(event.match_clock_ms); }
