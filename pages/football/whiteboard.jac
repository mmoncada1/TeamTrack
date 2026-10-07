import "./football.css";
import from "@jac/runtime" { Link }
import from ...state.AppState { use_app_state }
import from ...state.storage { create_id }
import from ...football.models { Point, Drawing, Whiteboard }
import from ...components.FootballField { FootballField }

def:pub FootballWhiteboardPage() -> JsxPage {
    state = use_app_state(); active = None;
    for team in state["teams"] { if team.id == state["activeTeamId"] { active = team; break; } }
    active_id = active.id if active else "";
    has drawings: list[Drawing] = []; has undo_stack: list[any] = []; has redo_stack: list[any] = [];
    has tool: str = "pen"; has ink: str = "#facc15"; has message: str = "";
    has drawing_points: list[Point] = []; has drawing_active: bool = False;
    can with [active_id] entry {
        drawings = []; undo_stack = []; redo_stack = []; drawing_points = []; drawing_active = False;
        for board in state["footballWhiteboards"] { if board.team_id == active_id { drawings = board.drawings; break; } }
    }
    def persist(next_drawings: list[Drawing]) {
        drawings = next_drawings;
        result = state["saveFootballWhiteboard"].call(None, Whiteboard(id=active_id, team_id=active_id, drawings=next_drawings, updated_at=int(Date.now())));
        message = result if result else "Saved on this device.";
    }
    def change(next_drawings: list[Drawing]) { undo_stack = undo_stack + [drawings]; redo_stack = []; persist(next_drawings); }
    def undo { if undo_stack { redo_stack = redo_stack + [drawings]; previous = undo_stack[-1]; undo_stack = undo_stack[:-1]; persist(previous); } }
    def redo { if redo_stack { undo_stack = undo_stack + [drawings]; next_drawings = redo_stack[-1]; redo_stack = redo_stack[:-1]; persist(next_drawings); } }
    def point(event: any) -> Point {
        rect = event.currentTarget.getBoundingClientRect();
        return Point(x=max(0.0, min(100.0, (event.clientX - rect.left) * 100 / rect.width)), y=max(0.0, min(100.0, (event.clientY - rect.top) * 100 / rect.height)));
    }
    def pointer_down(event: any) {
        at = point(event);
        if tool == "select" { return; }
        event.currentTarget.setPointerCapture(event.pointerId); drawing_active = True; drawing_points = [at, at];
    }
    def pointer_move(event: any) {
        if not drawing_active { return; }
        at = point(event);
        drawing_points = [drawing_points[0], at] if tool in ["line", "arrow"] else drawing_points + [at];
    }
    def pointer_up {
        if not drawing_active { return; }
        drawing_active = False;
        change(drawings + [Drawing(id=create_id("drawing"), tool=tool, color=ink, width=6.0 if tool == "erase" else 0.7, points=drawing_points)]); drawing_points = [];
    }
    blank = {"players": [], "quarterback_id": "", "snapper_id": ""};
    preview_drawings = drawings + ([Drawing(id="pending", tool=tool, color=ink, width=6.0 if tool == "erase" else 0.7, points=drawing_points)] if drawing_active else []);
    if not active or active.sport != "football" { return <section className="page narrow-page"><h1>Football whiteboard</h1><p>Choose a football team first.</p><Link to="/">Dashboard</Link></section>; }
    <section className="page football-page football-whiteboard"><h1>Football whiteboard</h1><p className="muted">A blank tactical field, saved separately from your plays.</p><div className="football-toolbar" aria-label="Drawing tools">{[<button key={kind} className={"button primary small" if tool == kind else "button secondary small"} onClick={lambda { tool = kind; }}>{"Select / move" if kind == "select" else kind.title()}</button> for kind in ["select", "pen", "line", "arrow", "erase"]]}<label>Ink <input aria-label="Ink color" type="color" value={ink} onChange={lambda (e: ChangeEvent) { ink = e.target.value; }} /></label><button className="button secondary small" disabled={not bool(undo_stack)} onClick={undo}>Undo</button><button className="button secondary small" disabled={not bool(redo_stack)} onClick={redo}>Redo</button><button className="button secondary small" onClick={lambda { change([]); }}>Clear drawings</button></div><div className="football-interactive-field"><FootballField item={blank} roster={[]} drawings={preview_drawings} /><div className="football-field-overlay" onPointerDown={pointer_down} onPointerMove={pointer_move} onPointerUp={pointer_up} onPointerCancel={pointer_up}></div></div>{<p role="status">{message}</p> if message else None}</section>
}
