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

def:pub new_formation(team_id: str, formation_id: str, slot_ids: list[str], now_ms: int) -> Formation {
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

def:pub play_from_formation(formation: Formation, play_id: str, snap_id: str, now_ms: int) -> Play {
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

def:pub move_drive_entry(items: list[DriveEntry], from_index: int, to_index: int) -> list[DriveEntry] {
    if from_index < 0 or to_index < 0 or from_index >= len(items) or to_index >= len(items) { return items; }
    result = items.copy(); moved = result.pop(from_index); result.insert(to_index, moved); return result;
}
