"""Pure event-sourced live game engine, ported from src/lib/matchEngine.ts and matchActions.ts."""

import from .models { Match, MatchEvent, MatchSettings }
import from .formations { formation_by_id }

obj StatusInterval {
    has status: str, position_id: str | None, start_ms: int, end_ms: int | None = None;
}

obj PlayerRuntimeState {
    has player_id: str,
        status: str = "bench",
        position_id: str | None = None,
        position_group: str | None = None,
        intervals: list[StatusInterval] = [],
        current_stint_start_ms: int | None = None,
        current_stint_ms: int = 0,
        total_field_ms: int = 0,
        total_bench_ms: int = 0,
        subs_in: int = 0,
        subs_out: int = 0,
        last_sub_time_ms: int | None = None,
        goals: int = 0,
        assists: int = 0;
}

obj DerivedMatchState {
    has status: str,
        current_half: int,
        assignments: dict[str, str],
        formation_id: str,
        player_states: dict[str, PlayerRuntimeState],
        included_player_ids: list[str],
        injured_player_ids: list[str],
        sent_off_player_ids: list[str],
        team_score: int,
        opponent_score: int,
        match_clock_ms: int,
        display_clock_ms: int,
        is_clock_running: bool;
}

obj MatchChange {
    has game: Match, summary: str;
}

def fresh_player_state(player_id: str) -> PlayerRuntimeState {
    return PlayerRuntimeState(player_id=player_id, intervals=[]);
}

def clone_match(game: Match, events: list[MatchEvent], now_ms: int) -> Match {
    return Match(id=game.id, team_id=game.team_id, team_name=game.team_name,
        opponent_name=game.opponent_name, date=game.date, settings=game.settings,
        pending_formation_id=game.pending_formation_id, kickoff_time=game.kickoff_time,
        title=game.title, roster_player_ids=game.roster_player_ids,
        unavailable_player_ids=game.unavailable_player_ids,
        pending_assignments=game.pending_assignments, events=events,
        active_alerts=game.active_alerts, created_at=game.created_at, updated_at=now_ms);
}

def make_event(game: Match, event_type: str, clock_ms: int, now_ms: int,
    player_ids: list[str] = [], note: str | None = None,
    data: dict[str, any] = {}) -> MatchEvent {
    return MatchEvent(id=f"{event_type.lower()}-{now_ms}-{len(game.events)}",
        type=event_type, match_clock_ms=clock_ms, timestamp=now_ms,
        player_ids=player_ids, note=note, data=data);
}

def append_event(game: Match, event: MatchEvent) -> Match {
    return clone_match(game, game.events + [event], event.timestamp);
}

def close_interval(state: PlayerRuntimeState, at_ms: int) {
    if state.current_stint_start_ms is None { return; }
    for interval in state.intervals {
        if interval.end_ms is None { interval.end_ms = at_ms; break; }
    }
    state.current_stint_start_ms = None;
}

def open_interval(state: PlayerRuntimeState, status: str, position_id: str | None, at_ms: int) {
    state.intervals.append(StatusInterval(status=status, position_id=position_id, start_ms=at_ms));
    state.status = status; state.position_id = position_id; state.current_stint_start_ms = at_ms;
}

def transition(state: PlayerRuntimeState, status: str, position_id: str | None, at_ms: int) {
    if state.status == status and state.position_id == position_id { return; }
    close_interval(state, at_ms); open_interval(state, status, position_id, at_ms);
}

def place_player(state: PlayerRuntimeState, status: str, position_id: str | None, at_ms: int) {
    if state.status == "field" and status == "field" and state.current_stint_start_ms is not None {
        state.position_id = position_id;
        for interval in state.intervals {
            if interval.end_ms is None { interval.position_id = position_id; break; }
        }
        return;
    }
    transition(state, status, position_id, at_ms);
}

def position_for_player(assignments: dict[str, str], player_id: str) -> str | None {
    for (position_id, assigned_id) in assignments.items() {
        if assigned_id == player_id { return position_id; }
    }
    return None;
}

def position_group(formation_id: str, position_id: str | None) -> str | None {
    if position_id is None { return None; }
    formation = formation_by_id(formation_id);
    if formation is None { return None; }
    for position in formation.positions {
        if position.id == position_id { return position.group; }
    }
    return None;
}

def:pub derive_match_state(game: Match, now_ms: int) -> DerivedMatchState {
    states: dict[str, PlayerRuntimeState] = {};
    for player_id in game.roster_player_ids {
        states[player_id] = fresh_player_state(player_id);
        if player_id in game.unavailable_player_ids { states[player_id].status = "unavailable"; }
    }
    assignments: dict[str, str] = {}; formation_id = game.settings.formation_id;
    status = "setup"; current_half = 1; team_score = 0; opponent_score = 0;
    started = False; ended = False; running_since: int | None = None;
    anchor_clock = 0; frozen_clock = 0; first_half_end: int | None = None;
    removed: list[str] = []; joined: list[str] = []; injured: list[str] = []; sent_off: list[str] = [];

    for event in game.events {
        data = event.data;
        if event.type == "MATCH_STARTED" {
            started = True; status = "in_progress"; running_since = event.timestamp;
            anchor_clock = event.match_clock_ms; formation_id = data["formation_id"];
            assignments = data["assignments"].copy();
            for player_id in game.roster_player_ids {
                state = states[player_id];
                if state.status == "unavailable" { continue; }
                slot = position_for_player(assignments, player_id);
                open_interval(state, "field" if slot is not None else "bench", slot, event.match_clock_ms);
            }
        } elif event.type == "MATCH_PAUSED" {
            status = "paused"; frozen_clock = event.match_clock_ms; running_since = None;
        } elif event.type == "MATCH_RESUMED" {
            status = "in_progress"; running_since = event.timestamp; anchor_clock = event.match_clock_ms;
        } elif event.type == "HALF_TIME" {
            status = "half_time"; frozen_clock = event.match_clock_ms;
            first_half_end = event.match_clock_ms; running_since = None;
        } elif event.type == "SECOND_HALF_STARTED" {
            status = "in_progress"; current_half = 2;
            running_since = event.timestamp; anchor_clock = event.match_clock_ms;
        } elif event.type == "FORMATION_CHANGED" {
            formation_id = data["to_formation_id"]; assignments = data["new_assignments"].copy();
            for player_id in states.keys() {
                if player_id in removed or states[player_id].status == "unavailable" { continue; }
                slot = position_for_player(assignments, player_id);
                place_player(states[player_id], "field" if slot is not None else "bench", slot, event.match_clock_ms);
            }
        } elif event.type == "PLAYER_JOINED" {
            player_id = data["player_id"];
            if player_id in removed { removed.remove(player_id); }
            if player_id not in joined { joined.append(player_id); }
            if player_id in injured { injured.remove(player_id); }
            if player_id not in states { states[player_id] = fresh_player_state(player_id); }
            if states[player_id].status == "unavailable" or states[player_id].current_stint_start_ms is None {
                open_interval(states[player_id], "bench", None, event.match_clock_ms);
            }
        } elif event.type == "PLAYER_UNAVAILABLE" or event.type == "PLAYER_REMOVED" or (event.type == "CARD" and data["color"] == "red") {
            player_id = data["player_id"];
            if player_id not in states or player_id in removed { continue; }
            state = states[player_id]; slot = state.position_id;
            if slot is not None and slot in assignments and assignments[slot] == player_id { del assignments[slot]; }
            if state.status != "unavailable" { close_interval(state, event.match_clock_ms); }
            state.status = "unavailable"; state.position_id = None;
            if event.type == "PLAYER_UNAVAILABLE" and player_id not in injured { injured.append(player_id); }
            elif event.type == "PLAYER_REMOVED" { removed.append(player_id); }
            else { sent_off.append(player_id); }
        } elif event.type == "PLAYER_AVAILABLE" {
            player_id = data["player_id"];
            if player_id in states and player_id not in removed and player_id not in sent_off and states[player_id].status == "unavailable" {
                if player_id in injured { injured.remove(player_id); }
                open_interval(states[player_id], "bench", None, event.match_clock_ms);
            }
        } elif event.type == "PLAYER_MOVED" {
            player_id = data["player_id"]; from_slot = data["from_slot"]; to_slot = data["to_slot"];
            if from_slot != "BENCH" and from_slot in assignments and assignments[from_slot] == player_id { del assignments[from_slot]; }
            if to_slot != "BENCH" { assignments[to_slot] = player_id; }
            if player_id in states { place_player(states[player_id], "bench" if to_slot == "BENCH" else "field", None if to_slot == "BENCH" else to_slot, event.match_clock_ms); }
        } elif event.type == "PLAYERS_SWAPPED" {
            a = data["player_a_id"]; b = data["player_b_id"]; pos_a = data["position_a_id"]; pos_b = data["position_b_id"];
            assignments[pos_a] = b; assignments[pos_b] = a;
            if a in states { place_player(states[a], "field", pos_b, event.match_clock_ms); }
            if b in states { place_player(states[b], "field", pos_a, event.match_clock_ms); }
        } elif event.type == "SUBSTITUTION" {
            player_in = data["player_in_id"]; player_out = data["player_out_id"]; slot = data["position_id"];
            assignments[slot] = player_in;
            if player_out in states { transition(states[player_out], "bench", None, event.match_clock_ms); states[player_out].subs_out += 1; states[player_out].last_sub_time_ms = event.match_clock_ms; }
            if player_in in states { transition(states[player_in], "field", slot, event.match_clock_ms); states[player_in].subs_in += 1; states[player_in].last_sub_time_ms = event.match_clock_ms; }
        } elif event.type == "GOAL" {
            if data["is_own_goal"] { opponent_score += 1; }
            elif data["team"] == "us" {
                team_score += 1; scorer = data.get("scorer_id"); assister = data.get("assister_id");
                if scorer is not None and scorer in states { states[scorer].goals += 1; }
                if assister is not None and assister in states { states[assister].assists += 1; }
            } else { opponent_score += 1; }
        } elif event.type == "MATCH_ENDED" {
            ended = True; status = "ended"; frozen_clock = event.match_clock_ms; running_since = None;
        }
    }

    clock_ms = anchor_clock + max(0, now_ms - running_since) if status == "in_progress" and running_since is not None else frozen_clock;
    closing_clock = frozen_clock if ended else clock_ms;
    for player_id in states.keys() {
        state = states[player_id];
        if player_id not in removed and state.status != "unavailable" {
            if not started {
                pending_slot = position_for_player(game.pending_assignments, player_id);
                state.status = "field" if pending_slot is not None else "bench"; state.position_id = pending_slot;
            }
            state.position_group = position_group(formation_id, state.position_id);
        }
        field_ms = 0; bench_ms = 0;
        for interval in state.intervals {
            finish = closing_clock if interval.end_ms is None else interval.end_ms;
            duration = max(0, finish - interval.start_ms);
            if interval.status == "field" { field_ms += duration; } else { bench_ms += duration; }
        }
        state.total_field_ms = field_ms; state.total_bench_ms = bench_ms;
        state.current_stint_ms = max(0, closing_clock - state.current_stint_start_ms) if state.current_stint_start_ms is not None else 0;
    }
    included = [player_id for player_id in states.keys() if player_id not in removed];
    display_clock = 0 if status == "half_time" else max(0, clock_ms - first_half_end) if current_half == 2 and first_half_end is not None else clock_ms;
    return DerivedMatchState(status=status, current_half=current_half,
        assignments=assignments if started else game.pending_assignments.copy(),
        formation_id=formation_id if started else game.pending_formation_id,
        player_states=states, included_player_ids=included,
        injured_player_ids=[item for item in injured if item in included],
        sent_off_player_ids=[item for item in sent_off if item in included],
        team_score=team_score, opponent_score=opponent_score, match_clock_ms=clock_ms,
        display_clock_ms=display_clock, is_clock_running=status == "in_progress" and running_since is not None);
}

def require_open(game: Match, now_ms: int) -> DerivedMatchState {
    state = derive_match_state(game, now_ms);
    if state.status == "setup" or state.status == "ended" { raise ValueError("Match action requires an active game."); }
    return state;
}

def:pub start_match(game: Match, now_ms: int) -> Match {
    if derive_match_state(game, now_ms).status != "setup" { raise ValueError("Match has already started."); }
    event = make_event(game, "MATCH_STARTED", 0, now_ms, list(game.pending_assignments.values()), data={
        "formation_id": game.pending_formation_id, "assignments": game.pending_assignments.copy(),
        "unavailable_player_ids": game.unavailable_player_ids.copy()});
    return append_event(game, event);
}

def:pub pause_match(game: Match, now_ms: int) -> Match {
    state = derive_match_state(game, now_ms);
    if state.status != "in_progress" { raise ValueError("Match is not running."); }
    return append_event(game, make_event(game, "MATCH_PAUSED", state.match_clock_ms, now_ms));
}

def:pub resume_match(game: Match, now_ms: int) -> Match {
    state = derive_match_state(game, now_ms);
    if state.status not in ["paused", "half_time"] { raise ValueError("Match is not paused."); }
    kind = "SECOND_HALF_STARTED" if state.status == "half_time" else "MATCH_RESUMED";
    return append_event(game, make_event(game, kind, state.match_clock_ms, now_ms));
}

def:pub go_to_half_time(game: Match, now_ms: int) -> Match {
    state = derive_match_state(game, now_ms);
    if state.status != "in_progress" { raise ValueError("Match is not running."); }
    return append_event(game, make_event(game, "HALF_TIME", state.match_clock_ms, now_ms));
}

def:pub end_match(game: Match, now_ms: int) -> Match {
    state = derive_match_state(game, now_ms);
    if state.status in ["setup", "ended"] { raise ValueError("Match cannot be ended from its current state."); }
    return append_event(game, make_event(game, "MATCH_ENDED", state.match_clock_ms, now_ms));
}

def:pub move_player(game: Match, player_id: str, to_slot: str, now_ms: int) -> Match {
    state = require_open(game, now_ms);
    if player_id not in state.player_states { raise ValueError("Unknown player."); }
    player = state.player_states[player_id];
    if player.status == "unavailable" { raise ValueError("Player is unavailable for this game."); }
    from_slot = player.position_id if player.position_id is not None else "BENCH";
    if from_slot == to_slot { return game; }
    if to_slot != "BENCH" and to_slot in state.assignments and state.assignments[to_slot] != player_id { raise ValueError("That position is already occupied."); }
    return append_event(game, make_event(game, "PLAYER_MOVED", state.match_clock_ms, now_ms, [player_id], data={"player_id": player_id, "from_slot": from_slot, "to_slot": to_slot}));
}

def:pub swap_players(game: Match, position_a_id: str, position_b_id: str, now_ms: int) -> Match {
    state = require_open(game, now_ms);
    if position_a_id not in state.assignments or position_b_id not in state.assignments { raise ValueError("Both positions must be occupied to swap players."); }
    a = state.assignments[position_a_id]; b = state.assignments[position_b_id];
    return append_event(game, make_event(game, "PLAYERS_SWAPPED", state.match_clock_ms, now_ms, [a, b], data={
        "player_a_id": a, "position_a_id": position_a_id, "player_b_id": b, "position_b_id": position_b_id}));
}

def:pub substitute_player(game: Match, player_in_id: str, position_id: str, now_ms: int) -> Match {
    state = require_open(game, now_ms);
    if position_id not in state.assignments { raise ValueError("That position is empty; use move instead of substitute."); }
    player_out_id = state.assignments[position_id];
    if player_out_id == player_in_id { raise ValueError("Cannot substitute a player for themself."); }
    if player_in_id not in state.player_states or state.player_states[player_in_id].status != "bench" { raise ValueError("The incoming player must be on the bench."); }
    return append_event(game, make_event(game, "SUBSTITUTION", state.match_clock_ms, now_ms, [player_in_id, player_out_id], data={
        "player_in_id": player_in_id, "player_out_id": player_out_id, "position_id": position_id}));
}

def:pub add_player_to_match(game: Match, player_id: str, now_ms: int) -> Match {
    state = require_open(game, now_ms);
    if player_id in state.included_player_ids { raise ValueError("That player is already in this game."); }
    return append_event(game, make_event(game, "PLAYER_JOINED", state.match_clock_ms, now_ms, [player_id], data={"player_id": player_id}));
}

def:pub mark_player_injured(game: Match, player_id: str, now_ms: int) -> Match {
    state = require_open(game, now_ms);
    if player_id not in state.included_player_ids { raise ValueError("That player is not in this game."); }
    if state.player_states[player_id].status == "unavailable" { raise ValueError("That player is already out of the game."); }
    return append_event(game, make_event(game, "PLAYER_UNAVAILABLE", state.match_clock_ms, now_ms, [player_id], data={"player_id": player_id, "reason": "injured"}));
}

def:pub return_player_to_bench(game: Match, player_id: str, now_ms: int) -> Match {
    state = require_open(game, now_ms);
    if player_id not in state.included_player_ids or state.player_states[player_id].status != "unavailable" { raise ValueError("That player is already available."); }
    if player_id in state.sent_off_player_ids { raise ValueError("That player was sent off and cannot return."); }
    return append_event(game, make_event(game, "PLAYER_AVAILABLE", state.match_clock_ms, now_ms, [player_id], data={"player_id": player_id}));
}

def:pub remove_player_from_match(game: Match, player_id: str, now_ms: int) -> Match {
    state = require_open(game, now_ms);
    if player_id not in state.included_player_ids { raise ValueError("That player is not in this game."); }
    return append_event(game, make_event(game, "PLAYER_REMOVED", state.match_clock_ms, now_ms, [player_id], data={"player_id": player_id}));
}

def remap_assignments(from_id: str, to_id: str, assignments: dict[str, str]) -> tuple[dict[str, str], list[str]] {
    old = formation_by_id(from_id); target = formation_by_id(to_id);
    if old is None or target is None { raise ValueError("Unknown formation."); }
    result: dict[str, str] = {}; moved: list[str] = []; used: list[str] = [];
    for old_pos in old.positions {
        if old_pos.id not in assignments { continue; }
        best = None; best_distance = 999999;
        for new_pos in target.positions {
            if new_pos.id in used or new_pos.group != old_pos.group { continue; }
            distance = -1 if new_pos.id == old_pos.id else (new_pos.x - old_pos.x) ** 2 + (new_pos.y - old_pos.y) ** 2;
            if distance < best_distance { best = new_pos; best_distance = distance; }
        }
        if best is None { moved.append(assignments[old_pos.id]); }
        else { result[best.id] = assignments[old_pos.id]; used.append(best.id); }
    }
    return (result, moved);
}

def:pub change_formation(game: Match, new_formation_id: str, now_ms: int) -> MatchChange {
    state = require_open(game, now_ms);
    target = formation_by_id(new_formation_id);
    if target is None or formation_by_id(state.formation_id) is None { raise ValueError("Unknown formation."); }
    if state.formation_id == new_formation_id { return MatchChange(game=game, summary="Formation unchanged."); }
    (assignments, moved) = remap_assignments(state.formation_id, new_formation_id, state.assignments);
    summary = f"Switched to {target.shape}. All players kept their equivalent positions." if not moved else f"Switched to {target.shape}. {len(moved)} player" + ("" if len(moved) == 1 else "s") + " moved to the bench (no equivalent position available).";
    event = make_event(game, "FORMATION_CHANGED", state.match_clock_ms, now_ms, list(assignments.values()), data={
        "from_formation_id": state.formation_id, "to_formation_id": new_formation_id,
        "new_assignments": assignments, "moved_to_bench_player_ids": moved, "summary": summary});
    return MatchChange(game=append_event(game, event), summary=summary);
}

def goal_data(team: str, is_own_goal: bool, scorer_id: str | None, assister_id: str | None) -> tuple[dict[str, any], list[str]] {
    actual_team = "us" if is_own_goal else team;
    scorer = None if actual_team == "opponent" else scorer_id;
    assister = assister_id if actual_team == "us" and not is_own_goal else None;
    if scorer is not None and scorer == assister { raise ValueError("The scorer and assister cannot be the same player."); }
    ids: list[str] = [];
    if scorer is not None { ids.append(scorer); }
    if assister is not None { ids.append(assister); }
    return ({"team": actual_team, "is_own_goal": is_own_goal, "scorer_id": scorer, "assister_id": assister}, ids);
}

def:pub record_goal(game: Match, team: str, is_own_goal: bool, scorer_id: str | None,
    assister_id: str | None, note: str | None, now_ms: int, match_clock_ms: int | None = None) -> Match {
    (data, ids) = goal_data(team, is_own_goal, scorer_id, assister_id);
    clock = derive_match_state(game, now_ms).match_clock_ms if match_clock_ms is None else match_clock_ms;
    return append_event(game, make_event(game, "GOAL", clock, now_ms, ids, note, data));
}

def:pub update_goal(game: Match, event_id: str, team: str, is_own_goal: bool,
    scorer_id: str | None, assister_id: str | None, note: str | None, now_ms: int,
    match_clock_ms: int | None = None) -> Match {
    (data, ids) = goal_data(team, is_own_goal, scorer_id, assister_id); events: list[MatchEvent] = []; found = False;
    for event in game.events {
        if event.id == event_id and event.type == "GOAL" {
            clock = event.match_clock_ms if match_clock_ms is None else match_clock_ms;
            events.append(MatchEvent(id=event.id, type="GOAL", match_clock_ms=clock,
                timestamp=event.timestamp, player_ids=ids, note=note, data=data)); found = True;
        } else { events.append(event); }
    }
    if not found { raise ValueError("Goal not found."); }
    return clone_match(game, events, now_ms);
}

def:pub record_card(game: Match, player_id: str, color: str, now_ms: int) -> Match {
    state = require_open(game, now_ms);
    if player_id not in state.included_player_ids { raise ValueError("That player is not in this game."); }
    prior_yellow = False;
    for event in game.events {
        if event.type == "CARD" and event.data["player_id"] == player_id {
            if event.data["color"] == "red" { raise ValueError("That player has already been sent off."); }
            if event.data["color"] == "yellow" { prior_yellow = True; }
        }
    }
    actual = "red" if color == "yellow" and prior_yellow else color;
    return append_event(game, make_event(game, "CARD", state.match_clock_ms, now_ms, [player_id], data={
        "player_id": player_id, "color": actual, "second_yellow": actual == "red" and color == "yellow"}));
}

def:pub record_note(game: Match, note: str, now_ms: int, match_clock_ms: int | None = None) -> Match {
    clock = derive_match_state(game, now_ms).match_clock_ms if match_clock_ms is None else match_clock_ms;
    return append_event(game, make_event(game, "NOTE", clock, now_ms, note=note));
}

def:pub update_note(game: Match, event_id: str, note: str, now_ms: int) -> Match {
    events: list[MatchEvent] = []; found = False;
    for event in game.events {
        if event.id == event_id and event.type == "NOTE" {
            events.append(MatchEvent(id=event.id, type=event.type, match_clock_ms=event.match_clock_ms,
                timestamp=event.timestamp, player_ids=event.player_ids, note=note, data=event.data)); found = True;
        } else { events.append(event); }
    }
    if not found { raise ValueError("Note not found."); }
    return clone_match(game, events, now_ms);
}

def:pub delete_event(game: Match, event_id: str, now_ms: int) -> Match {
    return clone_match(game, [event for event in game.events if event.id != event_id], now_ms);
}

def:pub can_undo(game: Match) -> bool {
    reversible = ["PLAYER_MOVED", "PLAYERS_SWAPPED", "SUBSTITUTION", "PLAYER_JOINED",
        "PLAYER_UNAVAILABLE", "PLAYER_AVAILABLE", "PLAYER_REMOVED", "GOAL", "CARD", "FORMATION_CHANGED"];
    return bool(game.events) and game.events[-1].type in reversible;
}

def:pub undo_last_action(game: Match, now_ms: int) -> Match {
    if not can_undo(game) { raise ValueError("Nothing to undo."); }
    return clone_match(game, game.events[:-1], now_ms);
}

def:pub reset_match(game: Match, now_ms: int) -> Match {
    clean = clone_match(game, [], now_ms); clean.active_alerts = []; return clean;
}
