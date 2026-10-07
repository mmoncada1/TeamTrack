"""Shared compact football field for formation and playbook cards."""
def:pub FootballField(item: any, roster: list[any], drawings: list[any] = [], actions: list[any] = [], selected_id: str = "") -> JsxElement {
    visible_drawings = drawings if Array.isArray(drawings) else [];
    visible_actions = actions if Array.isArray(actions) else [];
    def route_path(slot: any) -> str {
        result = "M " + str(slot.position.x) + " " + str(slot.position.y);
        for point in slot.route.points { result += " L " + str(slot.position.x + point.x) + " " + str(slot.position.y + point.y); }
        return result;
    }
    def motion_path(slot: any) -> str {
        result = "M " + str(slot.position.x) + " " + str(slot.position.y);
        for point in slot.motion { result += " L " + str(slot.position.x + point.x) + " " + str(slot.position.y + point.y); }
        return result;
    }
    def drawing_path(drawing: any) -> str {
        if not drawing.points { return ""; }
        result = "M " + str(drawing.points[0].x) + " " + str(drawing.points[0].y);
        for point in drawing.points[1:] { result += " L " + str(point.x) + " " + str(point.y); }
        return result;
    }
    def action_geometry(action: any) -> dict[str, float] {
        source = None; target = None;
        for slot in item.players {
            if slot.id == action.from_player_id { source = slot; }
            if slot.id == action.to_player_id { target = slot; }
        }
        if source is None or target is None { return {"x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0}; }
        end_x = action.target.x if action.target is not None else target.position.x;
        end_y = action.target.y if action.target is not None else target.position.y;
        if action.target is None and action.type != "snap" and target.route.points {
            end_x += target.route.points[-1].x; end_y += target.route.points[-1].y;
        }
        return {"x1": source.position.x, "y1": source.position.y, "x2": end_x, "y2": end_y};
    }
    def action_color(action: any) -> str {
        return "#93c5fd" if action.type == "snap" else "#fb923c" if action.type == "pass" else "#f472b6" if action.type == "handoff" else "#22d3ee";
    }
    def token_text(slot: any) -> str {
        for player in roster {
            if player.id == slot.roster_player_id {
                if player.photo_id { return ""; }
                words = player.name.strip().split();
                return (words[0][:1] + words[1][:1]).upper() if len(words) > 1 else player.name[:2].upper();
            }
        }
        return slot.label;
    }
    def assigned(slot: any) -> bool { return any([player.id == slot.roster_player_id for player in roster]); }
    <div className="football-preview" role="img" aria-label="7v7 football field and play art">
        <div className="football-end-zone">END ZONE · OFFENSE ↑</div>
        {[<div key={yard} className="football-yard" style={{"top": str(yard) + "%"}}><span>{str((90 - yard) // 2)}</span></div> for yard in [20, 30, 40, 50, 60, 70, 80, 90]]}
        <div className="football-scrimmage"><span>LINE OF SCRIMMAGE</span></div>
        <svg className="football-preview-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden={True}><defs><marker id="football-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>{[<path key={slot.id + "-route"} d={route_path(slot)} fill="none" stroke={"#facc15" if slot.id == selected_id else "white"} strokeWidth=".7" markerEnd={"url(#football-arrow)" if slot.route.type != "block" else None} /> for slot in item.players if slot.route.points]}{[<path key={slot.id + "-motion"} d={motion_path(slot)} fill="none" stroke="#c084fc" strokeWidth=".7" strokeDasharray="1.5 1" markerEnd="url(#football-arrow)" /> for slot in item.players if slot.motion]}{[<g key={action.id}><line x1={action_geometry(action)["x1"]} y1={action_geometry(action)["y1"]} x2={action_geometry(action)["x2"]} y2={action_geometry(action)["y2"]} stroke={action_color(action)} strokeWidth=".7" strokeDasharray={"1 2" if action.fake else "2 1" if action.type in ["pass", "pitch"] else None} markerEnd="url(#football-arrow)" /><text x={(action_geometry(action)["x1"] + action_geometry(action)["x2"]) / 2 + 1} y={(action_geometry(action)["y1"] + action_geometry(action)["y2"]) / 2} fill={action_color(action)} fontSize="2.4">{str(action.order + 1) + ": " + ("fake " if action.fake else "") + action.type}</text></g> for action in visible_actions]}{[<path key={drawing.id} d={drawing_path(drawing)} fill="none" stroke={drawing.color} strokeWidth={drawing.width} strokeLinecap="round" strokeLinejoin="round" markerEnd={"url(#football-arrow)" if drawing.tool == "arrow" else None} /> for drawing in visible_drawings]}</svg>
        {[<div key={slot.id} className={"football-preview-token qb" if slot.id == item.quarterback_id else "football-preview-token snapper" if slot.id == item.snapper_id else "football-preview-token"} style={{"left": str(slot.position.x) + "%", "top": str(slot.position.y) + "%"}}>{[<img key={player.id} src={player.photo_id} alt="" /> for player in roster if player.id == slot.roster_player_id and player.photo_id]}<strong>{token_text(slot)}</strong>{<em>{slot.label}</em> if assigned(slot) else None}{[<small key={player.id}>{player.name[:15] + "…" if len(player.name) > 16 else player.name}</small> for player in roster if player.id == slot.roster_player_id]}</div> for slot in item.players]}
    </div>
}
