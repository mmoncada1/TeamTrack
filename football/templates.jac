"""Original seven-player starter concepts shared by cards and new plays."""
import from .models { Play, Point, BallAction }
import from .domain { new_formation, play_from_formation, route_for_type }

def starter_definitions() -> list[dict[str, any]] {
    return [
        {"name": "Four Verticals", "routes": ["stay", "seam", "go", "go", "go", "go", "flat"], "description": "Four wide vertical stems with a releasing snapper and a flat outlet.", "tags": ["vertical", "spread"]},
        {"name": "Mesh", "routes": ["stay", "hitch", "corner", "drag", "drag", "post", "flat"], "description": "Two shallow crossers at slightly different depths; settle underneath zone coverage.", "tags": ["crossing", "short"]},
        {"name": "Slants", "routes": ["stay", "hitch", "slant", "slant", "slant", "slant", "flat"], "description": "Quick inside breaks with the back as a flat outlet.", "tags": ["quick"]},
        {"name": "Smash", "routes": ["stay", "block", "hitch", "corner", "corner", "hitch", "flat"], "description": "Pair a short hitch with a deeper corner on each side.", "tags": ["high-low"]},
        {"name": "Flood", "routes": ["stay", "flat", "go", "cross", "out", "go", "flat"], "description": "Three levels to the right sideline. Flip assignments to attack the opposite side.", "tags": ["sideline", "high-low"]},
        {"name": "Levels", "routes": ["stay", "hitch", "dig", "drag", "dig", "go", "flat"], "description": "Inside breaks at multiple depths stretch underneath defenders.", "tags": ["middle"]},
        {"name": "Stick", "routes": ["stay", "hitch", "go", "hitch", "flat", "go", "flat"], "description": "Short settle routes next to flat releases and outside vertical clears.", "tags": ["quick", "short"]},
        {"name": "Drive", "routes": ["stay", "block", "go", "drag", "dig", "go", "flat"], "description": "Shallow drag underneath an intermediate dig.", "tags": ["crossing", "high-low"]},
        {"name": "Shallow Cross", "routes": ["stay", "hitch", "go", "drag", "post", "go", "flat"], "description": "A fast shallow crosser with deep clearing routes.", "tags": ["crossing"]},
        {"name": "Curl / Flat", "routes": ["stay", "block", "curl", "flat", "flat", "curl", "hitch"], "description": "Curl receivers settle behind paired flat releases.", "tags": ["short", "high-low"]},
        {"name": "Post / Wheel", "routes": ["stay", "block", "post", "wheel", "dig", "go", "flat"], "description": "An inside post clears room for the adjacent wheel.", "tags": ["vertical"]},
        {"name": "Spacing", "routes": ["stay", "hitch", "hitch", "flat", "flat", "hitch", "hitch"], "description": "Distribute short receiving options across the field.", "tags": ["quick", "short"]},
        {"name": "Quick Screen", "routes": ["stay", "block", "hitch", "block", "block", "go", "flat"], "description": "Quick throw outside with nearby players assigned to block; adapt to your league rules.", "tags": ["screen"]},
        {"name": "Jet Motion Handoff", "routes": ["stay", "block", "go", "custom", "block", "go", "flat"], "description": "Motion a receiver behind the QB and hand off. Verify your league allows this exchange.", "tags": ["motion", "run"]},
        {"name": "Basic Pitch", "routes": ["stay", "block", "go", "block", "block", "go", "flat"], "description": "Pitch to the back behind the line of scrimmage.", "tags": ["run", "lateral"]}
    ];
}

def starter_play(team_id: str, name: str, play_id: str, slot_ids: list[str], snap_id: str, exchange_id: str, now_ms: int) -> Play {
    definition = None;
    for item in starter_definitions() { if item["name"] == name { definition = item; break; } }
    if definition is None { raise ValueError("Unknown starter concept."); }
    formation = new_formation(team_id, "starter", slot_ids, now_ms);
    for at in range(7) { formation.players[at].route = route_for_type(definition["routes"][at], 20.0 if at == 3 else 30.0, 1 if at < 4 else -1); }
    play = play_from_formation(formation, play_id, snap_id, now_ms);
    play.name = name; play.description = definition["description"]; play.tags = definition["tags"]; play.formation_id = None;
    if name == "Mesh" {
        play.players[3].route = route_for_type("drag", 37.0, 1);
        play.players[4].route = route_for_type("drag", 37.0, -1);
        for point in play.players[4].route.points { point.y -= 3.0; }
    }
    if name == "Levels" { play.players[4].route = route_for_type("dig", 40.0, -1); }
    if name == "Jet Motion Handoff" {
        play.players[3].motion = [Point(x=12.0, y=14.0)];
        play.players[3].route = route_for_type("custom");
        play.players[3].route.points = [Point(x=20.0, y=14.0), Point(x=40.0, y=8.0), Point(x=45.0, y=-15.0)];
    }
    if name in ["Jet Motion Handoff", "Basic Pitch"] {
        play.ball_actions.append(BallAction(id=exchange_id, type="handoff" if name == "Jet Motion Handoff" else "pitch",
            from_player_id=slot_ids[0], to_player_id=slot_ids[3] if name == "Jet Motion Handoff" else slot_ids[6],
            order=1, target=Point(x=49.0, y=87.0) if name == "Jet Motion Handoff" else Point(x=75.0, y=82.0)));
    }
    return play;
}
