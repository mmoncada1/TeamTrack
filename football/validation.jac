"""Invariants shared by football editors and persistence."""
import from .models { Formation, Play, DrivePlan, Point }

glob ROUTE_TYPES = ["go", "slant", "out", "dig", "post", "corner", "curl", "hitch",
    "flat", "wheel", "drag", "cross", "seam", "custom", "block", "stay"];
glob BALL_ACTION_TYPES = ["snap", "pass", "handoff", "pitch"];

def valid_point(point: Point, bounded: bool = False) -> bool {
    if bounded { return 0 <= point.x <= 100 and 0 <= point.y <= 100; }
    return point.x == point.x and point.y == point.y and abs(point.x) < 10000 and abs(point.y) < 10000;
}

def:pub formation_errors(formation: Formation) -> list[str] {
    errors: list[str] = [];
    if not formation.id or not formation.team_id or not formation.name.strip() or formation.side != "offense" {
        errors.append("Formation needs a name, team, and offensive side.");
    }
    if len(formation.players) != 7 { errors.append("An offensive formation must have exactly seven players."); return errors; }
    ids: list[str] = []; roster_ids: list[str] = [];
    for player in formation.players {
        if not player.id or not player.label.strip() or not valid_point(player.position, True)
            or player.route.type not in ROUTE_TYPES or not 3 <= player.route.depth <= 55
            or player.route.direction not in [-1, 1] or any([not valid_point(point) for point in player.route.points + player.motion]) {
            errors.append("Player assignments or route geometry are invalid.");
        }
        if player.id in ids { errors.append("Player slot IDs must be unique."); }
        ids.append(player.id);
        if player.roster_player_id is not None {
            if player.roster_player_id in roster_ids { errors.append("A roster player can occupy only one slot."); }
            roster_ids.append(player.roster_player_id);
        }
    }
    if formation.quarterback_id not in ids { errors.append("Designate exactly one quarterback."); }
    if formation.snapper_id not in ids or formation.snapper_id == formation.quarterback_id {
        errors.append("Designate a snapper separate from the quarterback.");
    }
    return errors;
}

def:pub play_errors(play: Play) -> list[str] {
    shape = Formation(id=play.id, team_id=play.team_id, name=play.name, side=play.side,
        players=play.players, quarterback_id=play.quarterback_id, snapper_id=play.snapper_id,
        created_at=play.created_at, updated_at=play.updated_at);
    errors = formation_errors(shape);
    if play.schema_version != 1 { errors.append("Unsupported play schema version."); }
    slot_ids = [player.id for player in play.players]; action_ids: list[str] = []; orders: list[int] = [];
    for action in play.ball_actions {
        if not action.id or action.type not in BALL_ACTION_TYPES or action.from_player_id not in slot_ids or action.to_player_id not in slot_ids or action.from_player_id == action.to_player_id or action.order < 0 or (action.target is not None and not valid_point(action.target, True)) {
            errors.append("Ball action is invalid.");
        }
        if action.id in action_ids { errors.append("Ball action IDs must be unique."); }
        if action.order in orders { errors.append("Ball action order must be unique."); }
        action_ids.append(action.id); orders.append(action.order);
    }
    for drawing in play.drawings {
        if not drawing.id or drawing.tool not in ["pen", "line", "arrow", "erase"] or drawing.width <= 0 or any([not valid_point(point, True) for point in drawing.points]) {
            errors.append("Drawing is invalid.");
        }
    }
    return errors;
}

def:pub drive_errors(drive: DrivePlan, play_ids: list[str]) -> list[str] {
    errors: list[str] = [];
    if not drive.id or not drive.team_id or not drive.name.strip() { errors.append("Drive plan needs a name and team."); }
    entry_ids: list[str] = [];
    for item in drive.entries {
        if not item.id or item.id in entry_ids or item.play_id not in play_ids {
            errors.append("Drive entry is invalid or refers to a missing play.");
        }
        entry_ids.append(item.id);
    }
    return errors;
}
