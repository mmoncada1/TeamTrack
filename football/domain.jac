"""Pure football formation, play, and drive operations."""
import from domain.models { Player }
import from .models { Point, Route, PlayerSlot, Formation, BallAction, Drawing, Play, DriveEntry }

def copy_point(point: Point) -> Point { return Point(x=point.x, y=point.y); }
def copy_slot(slot: PlayerSlot) -> PlayerSlot {
    route = Route(type=slot.route.type, points=[copy_point(point) for point in slot.route.points],
        depth=slot.route.depth, direction=slot.route.direction);
    return PlayerSlot(id=slot.id, label=slot.label, roster_player_id=slot.roster_player_id,
        position=copy_point(slot.position), route=route, motion=[copy_point(point) for point in slot.motion]);
}
def copy_action(action: BallAction) -> BallAction {
    return BallAction(id=action.id, type=action.type, from_player_id=action.from_player_id,
        to_player_id=action.to_player_id, order=action.order, fake=action.fake,
        target=copy_point(action.target) if action.target is not None else None);
}
def copy_drawing(drawing: Drawing) -> Drawing {
    return Drawing(id=drawing.id, tool=drawing.tool, color=drawing.color,
        width=drawing.width, points=[copy_point(point) for point in drawing.points]);
}

def new_formation(team_id: str, formation_id: str, slot_ids: list[str], now_ms: int) -> Formation {
    if len(slot_ids) != 7 or len(set(slot_ids)) != 7 { raise ValueError("Seven unique slot ids are required."); }
    positions = [(50.0, 85.0), (50.0, 70.0), (12.0, 70.0), (29.0, 73.0),
        (71.0, 73.0), (88.0, 70.0), (61.0, 82.0)];
    labels = ["QB", "C", "X", "Y", "Z", "W", "B"];
    slots: list[PlayerSlot] = [];
    for index in range(7) {
        slots.append(PlayerSlot(id=slot_ids[index], label=labels[index],
            position=Point(x=positions[index][0], y=positions[index][1]),
            route=Route(type="stay", depth=12.0, direction=1)));
    }
    return Formation(id=formation_id, team_id=team_id, name="Spread 7", players=slots,
        quarterback_id=slot_ids[0], snapper_id=slot_ids[1], created_at=now_ms, updated_at=now_ms);
}

def roster_rank(player: Player) -> tuple[int, str] {
    return (player.jersey_number if player.jersey_number is not None else 9999, player.name.lower());
}

def:pub autofill_from_roster(formation: Formation, roster: list[Player], now_ms: int) -> Formation {
    assigned = [slot.roster_player_id for slot in formation.players if slot.roster_player_id is not None];
    available = sorted([player for player in roster if player.team_id == formation.team_id
        and player.availability == "active" and player.id not in assigned], key=roster_rank);
    slots: list[PlayerSlot] = []; next_index = 0;
    for slot in formation.players {
        copy = copy_slot(slot);
        if copy.roster_player_id is None and next_index < len(available) {
            copy.roster_player_id = available[next_index].id; next_index += 1;
        }
        slots.append(copy);
    }
    return Formation(id=formation.id, team_id=formation.team_id, name=formation.name, side=formation.side,
        players=slots, quarterback_id=formation.quarterback_id, snapper_id=formation.snapper_id,
        created_at=formation.created_at, updated_at=now_ms);
}

def play_from_formation(formation: Formation, play_id: str, snap_id: str, now_ms: int) -> Play {
    return Play(id=play_id, team_id=formation.team_id, name="New play", side="offense",
        players=[copy_slot(slot) for slot in formation.players], quarterback_id=formation.quarterback_id,
        snapper_id=formation.snapper_id, formation_id=formation.id,
        ball_actions=[BallAction(id=snap_id, type="snap", from_player_id=formation.snapper_id,
            to_player_id=formation.quarterback_id, order=0)], created_at=now_ms, updated_at=now_ms);
}

def:pub duplicate_play(play: Play, new_id: str, now_ms: int) -> Play {
    return Play(id=new_id, team_id=play.team_id, name=play.name + " (copy)", side=play.side,
        players=[copy_slot(slot) for slot in play.players], quarterback_id=play.quarterback_id,
        snapper_id=play.snapper_id, schema_version=play.schema_version, description=play.description,
        formation_id=play.formation_id, tags=play.tags.copy(), ball_actions=[copy_action(action) for action in play.ball_actions],
        drawings=[copy_drawing(drawing) for drawing in play.drawings], created_at=now_ms, updated_at=now_ms);
}

def route_for_type(kind: str, depth: float = 25.0, direction: int = 1) -> Route {
    d = max(3.0, min(55.0, depth)); points: list[Point] = [];
    if kind in ["go", "seam"] { points = [Point(x=0.0, y=-d)]; }
    elif kind == "slant" { points = [Point(x=0.0, y=-d * 0.2), Point(x=d * 0.6 * direction, y=-d)]; }
    elif kind == "out" { points = [Point(x=0.0, y=-d), Point(x=-8.0 * direction, y=-d)]; }
    elif kind == "dig" { points = [Point(x=0.0, y=-d), Point(x=20.0 * direction, y=-d)]; }
    elif kind == "post" { points = [Point(x=0.0, y=-d * 0.55), Point(x=16.0 * direction, y=-d)]; }
    elif kind == "corner" { points = [Point(x=0.0, y=-d * 0.55), Point(x=-8.0 * direction, y=-d)]; }
    elif kind == "curl" { points = [Point(x=0.0, y=-d), Point(x=4.0 * direction, y=-d + 6.0)]; }
    elif kind == "hitch" { points = [Point(x=0.0, y=-d), Point(x=0.0, y=-d + 3.0)]; }
    elif kind == "flat" { points = [Point(x=-8.0 * direction, y=-4.0)]; }
    elif kind == "wheel" { points = [Point(x=-8.0 * direction, y=-3.0), Point(x=-9.0 * direction, y=-10.0), Point(x=-9.0 * direction, y=-d)]; }
    elif kind == "drag" { points = [Point(x=0.0, y=-5.0), Point(x=d * direction, y=-5.0)]; }
    elif kind == "cross" { points = [Point(x=0.0, y=-d * 0.3), Point(x=25.0 * direction, y=-d)]; }
    elif kind == "block" { points = [Point(x=0.0, y=-4.0)]; }
    return Route(type=kind, points=points, depth=d, direction=direction);
}

def:pub resize_route(route: Route, depth: float) -> Route {
    target = max(3.0, min(55.0, depth)); factor = target / route.depth;
    return Route(type=route.type, points=[Point(x=point.x, y=point.y * factor) for point in route.points], depth=target, direction=route.direction);
}
def:pub flip_route(route: Route) -> Route {
    return Route(type=route.type, points=[Point(x=-point.x, y=point.y) for point in route.points], depth=route.depth, direction=-route.direction);
}
def:pub rotate_route(route: Route, degrees: float) -> Route {
    radians = degrees * 3.141592653589793 / 180.0;
    cosine = 1.0; sine = radians; cos_term = 1.0; sin_term = radians;
    for index in range(1, 8) {
        cos_term *= -radians * radians / ((2 * index - 1) * (2 * index)); cosine += cos_term;
        sin_term *= -radians * radians / ((2 * index) * (2 * index + 1)); sine += sin_term;
    }
    return Route(type=route.type, points=[Point(x=point.x * cosine - point.y * sine, y=point.x * sine + point.y * cosine) for point in route.points], depth=route.depth, direction=route.direction);
}

def:pub drawing_near(drawing: Drawing, at: Point, radius: float = 3.0) -> bool {
    limit = radius * radius;
    for point in drawing.points { if (at.x - point.x) ** 2 + (at.y - point.y) ** 2 <= limit { return True; } }
    for index in range(len(drawing.points) - 1) {
        start = drawing.points[index]; end = drawing.points[index + 1];
        dx = end.x - start.x; dy = end.y - start.y; length = dx * dx + dy * dy;
        if length == 0 { continue; }
        factor = max(0.0, min(1.0, ((at.x - start.x) * dx + (at.y - start.y) * dy) / length));
        nearest_x = start.x + factor * dx; nearest_y = start.y + factor * dy;
        if (at.x - nearest_x) ** 2 + (at.y - nearest_y) ** 2 <= limit { return True; }
    }
    return False;
}

def:pub move_drive_entry(items: list[DriveEntry], from_index: int, to_index: int) -> list[DriveEntry] {
    if from_index < 0 or to_index < 0 or from_index >= len(items) or to_index >= len(items) { return items; }
    result = items.copy(); moved = result.pop(from_index); result.insert(to_index, moved); return result;
}
