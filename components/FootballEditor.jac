"""Shared formation and play editor, modeled on the TypeScript football editor."""
import from ..state.AppState { use_app_state }
import from ..state.storage { create_id }
import from ..football.models { Point, Drawing, BallAction }
import from ..football.domain { route_for_type, resize_route, flip_route, rotate_route }
import from .FootballField { FootballField }

glob ROUTE_OPTIONS = [("go", "Go / Fly"), ("slant", "Slant"), ("out", "Out"), ("dig", "In / Dig"), ("post", "Post"), ("corner", "Corner"), ("curl", "Curl / Comeback"), ("hitch", "Hitch"), ("flat", "Flat"), ("wheel", "Wheel"), ("drag", "Drag"), ("cross", "Crossing route"), ("seam", "Seam"), ("custom", "Custom route"), ("block", "Block"), ("stay", "Stay / no route")];

def:pub FootballEditor(initial: any, roster: list[any], formation_only: bool, on_close: any) -> JsxElement {
    state = use_app_state();
    has draft: any = structuredClone(initial); has saved_snapshot: str = JSON.stringify(initial);
    has undo_stack: list[any] = []; has redo_stack: list[any] = [];
    has selected_id: str = initial.players[2].id; has tool: str = "select"; has ink: str = "#facc15";
    has edit_path: str = ""; has target_action_id: str = ""; has message: str = "";
    has drag_kind: str = ""; has drag_id: str = ""; has drag_index: int = -1;
    has drag_offset_x: float = 0.0; has drag_offset_y: float = 0.0; has drawing_points: list[Point] = [];
    dirty = JSON.stringify(draft) != saved_snapshot;
    can with [dirty] entry {
        if dirty {
            handler = lambda (event: any) { event.preventDefault(); };
            nav_handler = lambda (event: any) {
                if event.defaultPrevented or event.button != 0 or event.metaKey or event.ctrlKey or event.shiftKey or event.altKey { return; }
                link = event.target.closest("a[href]") if event.target and event.target.closest else None;
                if link and link.origin == window.location.origin and link.href != window.location.href and not window.confirm("Discard unsaved edits?") { event.preventDefault(); event.stopPropagation(); }
            };
            window.addEventListener("beforeunload", handler);
            document.addEventListener("click", nav_handler, True);
            return lambda { window.removeEventListener("beforeunload", handler); document.removeEventListener("click", nav_handler, True); };
        }
    }
    selected = draft.players[0];
    for slot in draft.players { if slot.id == selected_id { selected = slot; break; } }
    assigned_count = len([slot for slot in draft.players if slot.roster_player_id]);
    available_count = len([player for player in roster if player.availability == "active" and not any([slot.roster_player_id == player.id for slot in draft.players])]);
    fill_count = min(7 - assigned_count, available_count);
    def checkpoint { undo_stack = undo_stack + [structuredClone(draft)]; redo_stack = []; message = ""; }
    def change(next_draft: any) { checkpoint(); draft = next_draft; }
    def undo { if undo_stack { redo_stack = redo_stack + [draft]; draft = undo_stack[-1]; undo_stack = undo_stack[:-1]; } }
    def redo { if redo_stack { undo_stack = undo_stack + [draft]; draft = redo_stack[-1]; redo_stack = redo_stack[:-1]; } }
    def back { if not dirty or window.confirm("Discard unsaved edits?") { on_close.call(None); } }
    def save {
        updated = structuredClone(draft); updated.updated_at = int(Date.now());
        result = state["saveFootballFormation"].call(None, updated) if formation_only else state["saveFootballPlay"].call(None, updated);
        message = result if result else "Saved on this device.";
        if not result { draft = updated; saved_snapshot = JSON.stringify(updated); }
    }
    def update_field(field: str, value: str) { updated = structuredClone(draft); updated[field] = value; change(updated); }
    def update_slot(field: str, value: str) {
        updated = structuredClone(draft);
        for slot in updated.players {
            if slot.id == selected_id {
                if field == "label" { slot.label = value; }
                elif field == "roster" { slot.roster_player_id = value if value else None; }
                elif field == "route" { slot.route = route_for_type(value, slot.route.depth, -1 if slot.position.x > 50 else 1); }
            } elif field == "roster" and value and slot.roster_player_id == value { slot.roster_player_id = None; }
        }
        change(updated);
        if field == "route" { edit_path = "route" if value == "custom" else ""; tool = "select"; }
    }
    def set_role(role: str, id: str) {
        updated = structuredClone(draft); previous = updated[role]; other = "snapper_id" if role == "quarterback_id" else "quarterback_id";
        if updated[other] == id { updated[other] = previous; }
        updated[role] = id;
        if not formation_only { for action in updated.ball_actions { if action.type == "snap" { action.from_player_id = updated.snapper_id; action.to_player_id = updated.quarterback_id; } } }
        change(updated);
    }
    def autofill {
        updated = structuredClone(draft); assigned = [slot.roster_player_id for slot in updated.players if slot.roster_player_id];
        available = sorted([player for player in roster if player.availability == "active" and player.id not in assigned], key=lambda (player: any) { (player.jersey_number if player.jersey_number is not None else 9999, player.name.lower()); });
        next_index = 0;
        for slot in updated.players { if not slot.roster_player_id and next_index < len(available) { slot.roster_player_id = available[next_index].id; next_index += 1; } }
        filled = next_index; change(updated); message = "Assigned " + str(filled) + " available roster player" + ("" if filled == 1 else "s") + ".";
    }
    def set_route_transform(kind: str, value: float = 0.0) {
        updated = structuredClone(draft);
        for slot in updated.players { if slot.id == selected_id {
            if kind == "depth" { slot.route = resize_route(slot.route, value); }
            elif kind == "flip" { slot.route = flip_route(slot.route); }
            elif kind == "rotate" { slot.route = rotate_route(slot.route, value); }
            elif kind == "pop" { slot.route.points = slot.route.points[:-1]; }
            elif kind == "clear_motion" { slot.motion = []; }
        } }
        change(updated);
    }
    def edit_action(id: str, field: str, value: any) {
        updated = structuredClone(draft);
        for action in updated.ball_actions { if action.id == id { action[field] = value; break; } }
        change(updated);
    }
    def add_action(kind: str) {
        updated = structuredClone(draft); recipient = selected_id if selected_id != updated.quarterback_id else updated.snapper_id;
        updated.ball_actions = updated.ball_actions + [BallAction(id=create_id("action"), type=kind, from_player_id=updated.quarterback_id, to_player_id=recipient, order=len(updated.ball_actions))]; change(updated);
    }
    def remove_action(id: str) {
        updated = structuredClone(draft); updated.ball_actions = [action for action in updated.ball_actions if action.id != id];
        for at in range(len(updated.ball_actions)) { updated.ball_actions[at].order = at; }
        change(updated);
    }
    def move_action(at: int, direction: int) {
        target = at + direction; if target < 1 or target >= len(draft.ball_actions) { return; }
        updated = structuredClone(draft); moved = updated.ball_actions.pop(at); updated.ball_actions.insert(target, moved);
        for position in range(len(updated.ball_actions)) { updated.ball_actions[position].order = position; }
        change(updated);
    }
    def point(event: any) -> Point {
        rect = event.currentTarget.getBoundingClientRect();
        return Point(x=max(0.0, min(100.0, (event.clientX - rect.left) * 100 / rect.width)), y=max(0.0, min(100.0, (event.clientY - rect.top) * 100 / rect.height)));
    }
    def pointer_down(event: any) {
        at = point(event);
        if target_action_id {
            edit_action(target_action_id, "target", at); target_action_id = ""; return;
        }
        if tool in ["pen", "line", "arrow", "erase"] {
            checkpoint(); drag_kind = "draw"; drawing_points = [at, at]; event.currentTarget.setPointerCapture(event.pointerId); return;
        }
        current = None;
        for slot in draft.players { if slot.id == selected_id { current = slot; break; } }
        if current is not None {
            points = current.motion if edit_path == "motion" else current.route.points;
            for at_index in range(len(points)) {
                handle = points[at_index];
                if (at.x - current.position.x - handle.x) ** 2 + (at.y - current.position.y - handle.y) ** 2 < 9 {
                    checkpoint(); drag_kind = "point"; drag_id = current.id; drag_index = at_index; event.currentTarget.setPointerCapture(event.pointerId); return;
                }
            }
        }
        for slot in draft.players {
            if (at.x - slot.position.x) ** 2 + (at.y - slot.position.y) ** 2 < 25 {
                selected_id = slot.id; edit_path = ""; checkpoint(); drag_kind = "player"; drag_id = slot.id;
                drag_offset_x = slot.position.x - at.x; drag_offset_y = slot.position.y - at.y;
                event.currentTarget.setPointerCapture(event.pointerId); return;
            }
        }
        if edit_path and current is not None {
            updated = structuredClone(draft);
            for slot in updated.players { if slot.id == selected_id {
                offset = Point(x=at.x - slot.position.x, y=at.y - slot.position.y);
                if edit_path == "motion" { slot.motion = slot.motion + [offset]; }
                else { slot.route.type = "custom"; slot.route.points = slot.route.points + [offset]; }
            } }
            change(updated);
        }
    }
    def pointer_move(event: any) {
        if not drag_kind { return; }
        at = point(event);
        if drag_kind == "draw" { drawing_points = [drawing_points[0], at] if tool in ["line", "arrow"] else drawing_points + [at]; return; }
        updated = structuredClone(draft);
        for slot in updated.players { if slot.id == drag_id {
            if drag_kind == "player" { slot.position.x = max(3.0, min(97.0, at.x + drag_offset_x)); slot.position.y = max(3.0, min(97.0, at.y + drag_offset_y)); }
            elif drag_kind == "point" {
                if edit_path == "motion" { slot.motion[drag_index] = Point(x=at.x - slot.position.x, y=at.y - slot.position.y); }
                else { slot.route.points[drag_index] = Point(x=at.x - slot.position.x, y=at.y - slot.position.y); }
            }
        } }
        draft = updated;
    }
    def pointer_up {
        if drag_kind == "draw" and drawing_points {
            updated = structuredClone(draft); updated.drawings = updated.drawings + [Drawing(id=create_id("drawing"), tool=tool, color=ink, width=6.0 if tool == "erase" else 0.7, points=drawing_points)]; draft = updated;
        }
        drag_kind = ""; drawing_points = [];
    }
    def key_down(event: any) {
        if event.key not in ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] or tool != "select" { return; }
        event.preventDefault(); updated = structuredClone(draft);
        for slot in updated.players { if slot.id == selected_id {
            slot.position.x = max(3.0, min(97.0, slot.position.x + (-1 if event.key == "ArrowLeft" else 1 if event.key == "ArrowRight" else 0)));
            slot.position.y = max(3.0, min(97.0, slot.position.y + (-1 if event.key == "ArrowUp" else 1 if event.key == "ArrowDown" else 0)));
        } }
        change(updated);
    }
    display_drawings = (draft.drawings if not formation_only else []) + ([Drawing(id="pending", tool=tool, color=ink, width=6.0 if tool == "erase" else 0.7, points=drawing_points)] if drawing_points else []);
    actions = draft.ball_actions if not formation_only else [];
    handles = selected.motion if edit_path == "motion" else selected.route.points;
    <section className="page football-page football-edit-screen"><div className="title-row"><h1>{"Formation editor" if formation_only else "Play editor"}</h1><div className="actions"><button className="button secondary" onClick={back}>Back</button><button className="button primary" onClick={save}>{"Save formation" if formation_only else "Save play"}</button></div></div><div className="football-name-grid"><label>{"Formation name" if formation_only else "Play name"}<input className="input" value={draft.name} onChange={lambda (e: ChangeEvent) { update_field("name", e.target.value); }} /></label>{<label>Tags (comma separated)<input className="input" value={", ".join(draft.tags)} onChange={lambda (e: ChangeEvent) { updated = structuredClone(draft); updated.tags = [value.strip() for value in e.target.value.split(",")]; change(updated); }} /></label> if not formation_only else None}</div>{<label>Notes<textarea className="input" rows={2} value={draft.description} onChange={lambda (e: ChangeEvent) { update_field("description", e.target.value); }} /></label> if not formation_only else None}{<p role="status" className="football-message">{message}</p> if message else None}<div className="football-toolbar" aria-label="Drawing tools">{[<button className={"button primary small" if tool == kind else "button secondary small"} key={kind} onClick={lambda { tool = kind; edit_path = ""; target_action_id = ""; }}>{"Select / move" if kind == "select" else kind.title()}</button> for kind in (["select"] if formation_only else ["select", "pen", "line", "arrow", "erase"])]}{<label>Ink <input aria-label="Ink color" type="color" value={ink} onChange={lambda (e: ChangeEvent) { ink = e.target.value; }} /></label> if not formation_only else None}<button className="button secondary small" disabled={not bool(undo_stack)} onClick={undo}>Undo</button><button className="button secondary small" disabled={not bool(redo_stack)} onClick={redo}>Redo</button>{<button className="button secondary small" onClick={lambda { updated = structuredClone(draft); updated.drawings = []; change(updated); }}>Clear drawings</button> if not formation_only else None}</div><div className="football-autofill"><button className="button secondary" disabled={fill_count == 0} onClick={autofill}>Autofill from roster</button><span className="muted">{str(assigned_count) + " / 7 assigned"}</span><p className="muted">Fills empty slots with available players by jersey number. Keeps your existing assignments.</p></div><div className="football-editor-grid"><div><div className="football-interactive-field"><FootballField item={draft} roster={roster} drawings={display_drawings} actions={actions} selected_id={selected_id} /><div className="football-field-overlay" role="group" tabIndex={0} aria-label="7v7 football field and play art" onPointerDown={pointer_down} onPointerMove={pointer_move} onPointerUp={pointer_up} onPointerCancel={pointer_up} onKeyDown={key_down}></div>{[<div className="football-point-handle" key={at} style={{"left": str(selected.position.x + point.x) + "%", "top": str(selected.position.y + point.y) + "%"}}></div> for (at, point) in enumerate(handles) if tool == "select"]}</div><p className="muted football-field-hint">Drag players or select a token and use arrow keys. Gold = QB; blue = snapper. Drag gold route points to reshape a path. Purple = pre-snap motion. Yard marks are tactical references.</p>{<p role="status">{"Click the field to add " + edit_path + " points; drag handles to adjust them."}</p> if edit_path else None}{<p role="status">Click the field to place the exchange or throw target.</p> if target_action_id else None}</div><aside className="football-assignment-panel"><h2>Player assignments</h2><label>Selected player<select className="input" value={selected_id} onChange={lambda (e: ChangeEvent) { selected_id = e.target.value; edit_path = ""; }}>{[<option key={slot.id} value={slot.id}>{slot.label}</option> for slot in draft.players]}</select></label><label>Slot label<input className="input" maxLength={5} value={selected.label} onChange={lambda (e: ChangeEvent) { update_slot("label", e.target.value); }} /></label><label>Roster player<select className="input" value={selected.roster_player_id or ""} onChange={lambda (e: ChangeEvent) { update_slot("roster", e.target.value); }}><option value="">Unassigned</option>{[<option key={player.id} value={player.id}>{player.name + (" (unavailable)" if player.availability == "unavailable" else "")}</option> for player in roster]}</select></label><label>Quarterback<select className="input" value={draft.quarterback_id} onChange={lambda (e: ChangeEvent) { set_role("quarterback_id", e.target.value); }}>{[<option key={slot.id} value={slot.id}>{slot.label}</option> for slot in draft.players]}</select></label><label>Snapper<select className="input" value={draft.snapper_id} onChange={lambda (e: ChangeEvent) { set_role("snapper_id", e.target.value); }}>{[<option key={slot.id} value={slot.id}>{slot.label}</option> for slot in draft.players]}</select></label>{<><label>Route / assignment<select className="input" value={selected.route.type} onChange={lambda (e: ChangeEvent) { update_slot("route", e.target.value); }}>{[<option key={kind} value={kind}>{label}</option> for (kind, label) in ROUTE_OPTIONS]}</select></label><label>Route depth<input aria-label="Route depth" type="range" min="3" max="55" value={selected.route.depth} onChange={lambda (e: ChangeEvent) { set_route_transform("depth", float(e.target.value)); }} /></label><div className="actions"><button className="button secondary small" onClick={lambda { set_route_transform("flip"); }}>Flip left/right</button><button className="button secondary small" onClick={lambda { set_route_transform("rotate", -15.0); }}>Rotate ↶</button><button className="button secondary small" onClick={lambda { set_route_transform("rotate", 15.0); }}>Rotate ↷</button></div><div className="actions"><button className={"button primary small" if edit_path == "route" else "button secondary small"} onClick={lambda { edit_path = "" if edit_path == "route" else "route"; tool = "select"; }}>Draw route points</button><button className="button secondary small" onClick={lambda { set_route_transform("pop"); }}>Remove last point</button></div><div className="actions"><button className={"button primary small" if edit_path == "motion" else "button secondary small"} onClick={lambda { edit_path = "" if edit_path == "motion" else "motion"; tool = "select"; }}>Add / edit motion</button><button className="button secondary small" onClick={lambda { set_route_transform("clear_motion"); }}>Clear motion</button></div></> if not formation_only else None}</aside></div>{<section className="football-sequence"><h2>Ball sequence</h2><p className="muted">Actions run in order. Fake exchanges keep possession with the sender. Place a target for a handoff, pitch, or throw away from a route endpoint.</p>{[<div className="football-action-row" key={action.id}><span>{str(at + 1) + "."}</span><select className="input" aria-label={"Action " + str(at + 1) + " type"} disabled={action.type == "snap"} value={action.type} onChange={lambda (e: ChangeEvent) { edit_action(action.id, "type", e.target.value); }}>{[<option key={kind} value={kind}>{kind.title()}</option> for kind in (["snap"] if action.type == "snap" else ["pass", "handoff", "pitch"])]}</select><select className="input" aria-label={"Action " + str(at + 1) + " from"} disabled={action.type == "snap"} value={action.from_player_id} onChange={lambda (e: ChangeEvent) { edit_action(action.id, "from_player_id", e.target.value); }}>{[<option key={slot.id} value={slot.id}>{slot.label}</option> for slot in draft.players]}</select><span>→</span><select className="input" aria-label={"Action " + str(at + 1) + " to"} disabled={action.type == "snap"} value={action.to_player_id} onChange={lambda (e: ChangeEvent) { edit_action(action.id, "to_player_id", e.target.value); }}>{[<option key={slot.id} value={slot.id}>{slot.label}</option> for slot in draft.players]}</select>{<><label><input type="checkbox" checked={action.fake} onChange={lambda (e: ChangeEvent) { edit_action(action.id, "fake", e.target.checked); }} /> Fake</label><button className="button secondary small" onClick={lambda { target_action_id = action.id; tool = "select"; edit_path = ""; }}>Place target</button><button className="button secondary small" onClick={lambda { edit_action(action.id, "target", None); }}>Use route end</button><button className="button ghost small" aria-label={"Move action " + str(at + 1) + " up"} disabled={at <= 1} onClick={lambda { move_action(at, -1); }}>↑</button><button className="button ghost small" aria-label={"Move action " + str(at + 1) + " down"} disabled={at == len(draft.ball_actions) - 1} onClick={lambda { move_action(at, 1); }}>↓</button><button className="button danger small" onClick={lambda { remove_action(action.id); }}>Remove action</button></> if action.type != "snap" else None}</div> for (at, action) in enumerate(draft.ball_actions)]}<div className="actions">{[<button className="button secondary small" key={kind} onClick={lambda { add_action(kind); }}>{"Add pitch / lateral" if kind == "pitch" else "Add " + kind}</button> for kind in ["pass", "handoff", "pitch"]]}</div></section> if not formation_only else None}</section>
}
