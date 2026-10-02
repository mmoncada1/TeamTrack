"""Pure playing-time substitution recommendations ported from recommendations.ts."""

import from .models { Player, FormationPosition, ThresholdSetting }
import from .live_match { PlayerRuntimeState }
import from .formations { formation_by_id }

obj RecommendationContext {
    has players: list[Player],
        player_states: dict[str, PlayerRuntimeState],
        thresholds: dict[str, ThresholdSetting],
        goalkeeper_rotation_enabled: bool,
        roster_order: list[str],
        positions: list[FormationPosition],
        exclude_player_ids: list[str] = [],
        prefer_gender: str | None = None;
}

obj ExceededCandidate {
    has player_id: str, position_id: str, overage_ms: int, threshold_ms: int;
}

obj IncomingRecommendation {
    has player_id: str, explanation: str;
}

obj SubstitutionRecommendation {
    has outgoing_player_id: str, incoming_player_id: str, position_id: str, explanation: str;
}

def:pub player_by_id(players: list[Player], player_id: str) -> Player | None {
    for player in players { if player.id == player_id { return player; } }
    return None;
}

def player_groups(player: Player) -> list[str] {
    return player.preferred_groups if player.preferred_groups else [player.preferred_group];
}

def position_by_id(positions: list[FormationPosition], position_id: str) -> FormationPosition | None {
    for position in positions { if position.id == position_id { return position; } }
    return None;
}

def roster_index(roster_order: list[str], player_id: str) -> int {
    for (index, current) in enumerate(roster_order) { if current == player_id { return index; } }
    return 999999;
}

def:pub find_exceeded_outgoing_candidates(context: RecommendationContext) -> list[ExceededCandidate] {
    candidates: list[ExceededCandidate] = [];
    for state in context.player_states.values() {
        if state.status != "field" or state.position_id is None or state.position_group is None { continue; }
        if state.position_group == "GK" and not context.goalkeeper_rotation_enabled { continue; }
        if player_by_id(context.players, state.player_id) is None { continue; }
        if state.position_group not in context.thresholds { continue; }
        threshold = context.thresholds[state.position_group];
        if not threshold.enabled { continue; }
        threshold_ms = threshold.minutes * 60_000;
        if state.current_stint_ms >= threshold_ms {
            candidates.append(ExceededCandidate(player_id=state.player_id, position_id=state.position_id,
                overage_ms=state.current_stint_ms - threshold_ms, threshold_ms=threshold_ms));
        }
    }
    return sorted(candidates, key=lambda (item: ExceededCandidate) { -item.overage_ms; });
}

def incoming_rank(state: PlayerRuntimeState, context: RecommendationContext,
    position_group: str | None) -> tuple[int, int, int, int, int] {
    player = player_by_id(context.players, state.player_id);
    gender_rank = 0 if context.prefer_gender is not None and player is not None and player.gender == context.prefer_gender else 1 if context.prefer_gender is not None else 0;
    matches = player is not None and position_group is not None and position_group in player_groups(player);
    return (gender_rank, 0 if matches else 1, -state.current_stint_ms,
        state.total_field_ms, roster_index(context.roster_order, state.player_id));
}

def:pub recommend_incoming_player(position_id: str, context: RecommendationContext) -> IncomingRecommendation | None {
    position = position_by_id(context.positions, position_id);
    group = position.group if position is not None else None;
    candidates = [state for state in context.player_states.values()
        if state.status == "bench" and state.player_id not in context.exclude_player_ids
        and player_by_id(context.players, state.player_id) is not None];
    if not candidates { return None; }
    ranked = sorted(candidates, key=lambda (state: PlayerRuntimeState) { incoming_rank(state, context, group); });
    best = ranked[0]; player = player_by_id(context.players, best.player_id);
    reasons: list[str] = [];
    if context.prefer_gender is not None and player is not None and player.gender == context.prefer_gender {
        reasons.append("keeps a girl on the field");
    }
    if player is not None and group is not None and group in player_groups(player) and position is not None {
        reasons.append(f"matches the {position.label.lower()} role");
    }
    minutes = round(best.current_stint_ms / 60_000);
    reasons.append(f"has the longest current bench time ({minutes} minute" + ("" if minutes == 1 else "s") + ")");
    return IncomingRecommendation(player_id=best.player_id, explanation=" and ".join(reasons));
}

def:pub recommend_substitution(context: RecommendationContext) -> SubstitutionRecommendation | None {
    for candidate in find_exceeded_outgoing_candidates(context) {
        incoming = recommend_incoming_player(candidate.position_id, context);
        if incoming is None { continue; }
        outgoing_player = player_by_id(context.players, candidate.player_id);
        incoming_player = player_by_id(context.players, incoming.player_id);
        position = position_by_id(context.positions, candidate.position_id);
        outgoing_name = outgoing_player.name if outgoing_player is not None else "Unknown";
        incoming_name = incoming_player.name if incoming_player is not None else "Unknown";
        position_name = position.label if position is not None else candidate.position_id;
        explanation = f"Recommended: {incoming_name} for {outgoing_name} at {position_name}. {incoming_name} {incoming.explanation}.";
        return SubstitutionRecommendation(outgoing_player_id=candidate.player_id,
            incoming_player_id=incoming.player_id, position_id=candidate.position_id,
            explanation=explanation);
    }
    return None;
}

def:pub recommend_incoming_for_player(outgoing_player_id: str,
    context: RecommendationContext) -> IncomingRecommendation | None {
    if outgoing_player_id not in context.player_states { return None; }
    state = context.player_states[outgoing_player_id];
    if state.position_id is None { return None; }
    return recommend_incoming_player(state.position_id, context);
}
