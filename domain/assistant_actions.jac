"""Validate coach-approved assistant actions against the current event log."""
import from .models { Match, Player }
import from .live_match { derive_match_state, substitute_player }
import from .lineups { move_assignment, move_breaks_coed_rule }

def:pub apply_substitution_plan(game: Match, suggestions: list[any], players: list[Player],
    min_girls: int | None, now_ms: int) -> dict[str, any] {
    if not suggestions or len(suggestions) > 5 {
        return {"error": "This substitution plan is no longer available. Ask TeamTrack again."};
    }
    next_game = game; used_ids: list[str] = [];
    for suggestion in suggestions {
        current = derive_match_state(next_game, now_ms);
        if current.status not in ["in_progress", "paused", "half_time"] {
            return {"error": "This substitution plan is no longer available. Ask TeamTrack again."};
        }
        position_id = suggestion["position_id"]; outgoing_id = suggestion["outgoing_player_id"];
        incoming_id = suggestion["incoming_player_id"];
        if outgoing_id in used_ids or incoming_id in used_ids or outgoing_id == incoming_id or
            position_id not in current.assignments or current.assignments[position_id] != outgoing_id or
            incoming_id not in current.player_states or current.player_states[incoming_id].status != "bench" {
            return {"error": "The lineup changed. Ask TeamTrack for a new substitution plan."};
        }
        available = [player for player in players if player.id in current.included_player_ids and
            current.player_states[player.id].status != "unavailable"];
        next_assignments = move_assignment(current.assignments, incoming_id, position_id);
        if min_girls is not None and move_breaks_coed_rule(available,
            current.assignments, next_assignments, min_girls) {
            return {"error": "This plan would break the team's coed rule. Ask TeamTrack again."};
        }
        next_game = substitute_player(next_game, incoming_id, position_id, now_ms);
        used_ids.append(incoming_id); used_ids.append(outgoing_id);
    }
    return {"game": next_game};
}

def:pub goal_proposal_is_current(game: Match, proposal: any, now_ms: int) -> bool {
    current = derive_match_state(game, now_ms);
    return proposal["match_id"] == game.id and current.status in ["in_progress", "paused", "half_time"] and
        proposal["team_score"] == current.team_score and proposal["opponent_score"] == current.opponent_score and
        proposal["event_count"] == len(game.events);
}
