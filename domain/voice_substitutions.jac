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
    incoming_name = ""; outgoing_name = "";
    if command.startswith("substitute out ") { outgoing_name = command[15:]; }
    elif command.startswith("sub out ") { outgoing_name = command[8:]; }
    else {
        if command.startswith("substitute ") { command = command[11:]; }
        elif command.startswith("sub ") { command = command[4:]; }
        if command.endswith(" out") { outgoing_name = command[:-4]; }
        else {
            parts = command.split(" in for ");
            if len(parts) != 2 or not parts[0] or not parts[1] {
                return {"error": "Say 'Sub out Matteo' or 'Katie in for Matteo'."};
            }
            incoming_name = parts[0]; outgoing_name = parts[1];
        }
    }
    if not outgoing_name { return {"error": "Say which player should come off the field."}; }
    incoming_id = "";
    if incoming_name {
        incoming = matching_players(incoming_name, players);
        if not incoming { return {"error": "Could not find the incoming player: " + incoming_name + "."}; }
        if len(incoming) > 1 { return {"error": "More than one player matches " + incoming_name + ". Say a full name."}; }
        if incoming[0].id not in bench_ids { return {"error": incoming[0].name + " is not on the bench."}; }
        incoming_id = incoming[0].id;
    }
    outgoing = matching_players(outgoing_name, players);
    if not outgoing { return {"error": "Could not find the outgoing player: " + outgoing_name + "."}; }
    if len(outgoing) > 1 { return {"error": "More than one player matches " + outgoing_name + ". Say a full name."}; }
    for (slot, player_id) in assignments.items() {
        if player_id == outgoing[0].id {
            return {"in_id": incoming_id, "out_id": outgoing[0].id, "slot_id": slot};
        }
    }
    return {"error": outgoing[0].name + " is not on the field."};
}
