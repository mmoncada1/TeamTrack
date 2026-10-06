"""Pure saved-lineup assignment and automatic-fill behavior."""
import from .models { Formation, FormationPosition, Player }
import from .roster { sort_players }

obj FillResult { has assignments: dict[str, str], summary: str; }

def player_rank(player: Player, group: str) -> tuple[int, int, int, int, str] {
    groups = player.preferred_groups if player.preferred_groups else [player.preferred_group];
    primary = 0 if groups and groups[0] == group else 1;
    listed = 0 if group in groups else 1;
    only = 0 if len(groups) == 1 else 1;
    number = player.jersey_number if player.jersey_number is not None else 9999;
    return (listed, primary, only, number, player.name.lower());
}

def assign_group(formation: Formation, eligible: list[Player], used: list[str], assignments: dict[str, str]) {
    for position in formation.positions {
        if position.id in assignments { continue; }
        candidates = [player for player in eligible if player.id not in used and position.group in player.preferred_groups];
        if candidates {
            candidates = sorted(candidates, key=lambda (player: Player) { player_rank(player, position.group); });
            chosen = candidates[0]; assignments[position.id] = chosen.id; used.append(chosen.id);
        }
    }
}

def:pub fill_formation(formation: Formation, players: list[Player], min_girls: int | None = None) -> FillResult {
    eligible = sort_players([player for player in players if player.availability == "active"]);
    used: list[str] = []; assignments: dict[str, str] = {};
    if min_girls is None { assign_group(formation, eligible, used, assignments); }
    else {
        girls = [player for player in eligible if player.gender == "girl"];
        assign_group(formation, girls, used, assignments);
        if len(used) >= min_girls { assign_group(formation, [player for player in eligible if player.gender != "girl"], used, assignments); }
    }
    filled = len(assignments); open_slots = len(formation.positions) - filled;
    summary = f"Filled {formation.shape} with {filled} players by preferred position.";
    if open_slots > 0 { summary += f" {open_slots} position" + ("" if open_slots == 1 else "s") + " left open."; }
    return FillResult(assignments=assignments, summary=summary);
}

def:pub move_assignment(assignments: dict[str, str], player_id: str, to_slot: str) -> dict[str, str] {
    result = assignments.copy(); from_slot = "BENCH";
    for (slot, assigned_id) in result.items() { if assigned_id == player_id { from_slot = slot; break; } }
    if from_slot == to_slot { return assignments; }
    occupant = result[to_slot] if to_slot != "BENCH" and to_slot in result else None;
    if from_slot != "BENCH" { del result[from_slot]; }
    if to_slot != "BENCH" {
        if occupant and occupant != player_id and from_slot != "BENCH" { result[from_slot] = occupant; }
        result[to_slot] = player_id;
    }
    return result;
}

def:pub clear_slot(assignments: dict[str, str], slot: str) -> dict[str, str] {
    result = assignments.copy();
    if slot in result { del result[slot]; }
    return result;
}

def field_tally(players: list[Player], assignments: dict[str, str]) -> tuple[int, int] {
    girls = 0; others = 0;
    for player_id in assignments.values() {
        player = None;
        for candidate in players { if candidate.id == player_id { player = candidate; break; } }
        if player and player.gender == "girl" { girls += 1; } else { others += 1; }
    }
    return (girls, others);
}

def:pub move_breaks_coed_rule(players: list[Player], before: dict[str, str], after: dict[str, str], min_girls: int) -> bool {
    (before_girls, before_others) = field_tally(players, before); (after_girls, after_others) = field_tally(players, after);
    if after_others == 0 or after_girls >= min_girls { return False; }
    if after_girls > before_girls or after_others < before_others { return False; }
    return True;
}

