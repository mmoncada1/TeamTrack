"""Resolve a spoken substitution against the current match roster."""

import from .models { Player }

def normalized_name(value: str) -> str {
    cleaned = value.lower();
    for mark in [".", ",", "!", "?", "'"] { cleaned = cleaned.replace(mark, ""); }
    return " ".join(cleaned.split());
}

def edit_distance(left: str, right: str) -> int {
    previous = list(range(len(right) + 1));
    for (left_index, left_letter) in enumerate(left) {
        current = [left_index + 1];
        for (right_index, right_letter) in enumerate(right) {
            change = 0 if left_letter == right_letter else 1;
            current.append(min(current[right_index] + 1, previous[right_index + 1] + 1,
                previous[right_index] + change));
        }
        previous = current;
    }
    return previous[-1];
}

def matching_players(spoken: str, players: list[Player]) -> list[Player] {
    exact = [player for player in players if normalized_name(player.name) == spoken];
    if exact { return exact; }
    first_name = [player for player in players if normalized_name(player.name).split()[0] == spoken];
    if first_name { return first_name; }
    # Short words are too easy to misidentify; longer names can tolerate two errors.
    max_edits = 2 if len(spoken) >= 8 else 1 if len(spoken) >= 4 else 0;
    closest: list[Player] = []; best = max_edits + 1;
    for player in players {
        name = normalized_name(player.name);
        distance = min(edit_distance(spoken, name), edit_distance(spoken, name.split()[0]));
        if distance < best { closest = [player]; best = distance; }
        elif distance == best { closest.append(player); }
    }
    return closest if best <= max_edits else [];
}

def:pub resolve_voice_substitution(transcript: str, players: list[Player],
    assignments: dict[str, str], bench_ids: list[str]) -> dict[str, str] {
    command = normalized_name(transcript);
    if command.startswith("substitute ") { command = command[11:]; }
    elif command.startswith("sub ") { command = command[4:]; }
    parts = command.split(" in for ");
    if len(parts) != 2 or not parts[0] or not parts[1] {
        return {"error": "Say a command like 'Matteo in for Katie'."};
    }
    incoming = matching_players(parts[0], players);
    outgoing = matching_players(parts[1], players);
    if not incoming { return {"error": "Could not find the incoming player: " + parts[0] + "."}; }
    if len(incoming) > 1 { return {"error": "More than one player matches " + parts[0] + ". Say a full name."}; }
    if not outgoing { return {"error": "Could not find the outgoing player: " + parts[1] + "."}; }
    if len(outgoing) > 1 { return {"error": "More than one player matches " + parts[1] + ". Say a full name."}; }
    if incoming[0].id not in bench_ids { return {"error": incoming[0].name + " is not on the bench."}; }
    for (slot, player_id) in assignments.items() {
        if player_id == outgoing[0].id {
            return {"in_id": incoming[0].id, "out_id": outgoing[0].id, "slot_id": slot};
        }
    }
    return {"error": outgoing[0].name + " is not on the field."};
}
