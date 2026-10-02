import "./whiteboard.css";
import from ..state.AppState { use_app_state }

glob BOARD_COLORS = ["#ffffff", "#facc15", "#ef4444", "#38bdf8", "#111827"];
glob BOARD_WIDTHS = [3, 6, 10];

def board_key(team_id: str) -> str { return "teamtrack:whiteboard:" + team_id; }
def empty_board() -> dict[str, list[any]] { return {"strokes": [], "notes": []}; }
def load_board(team_id: str) -> dict[str, list[any]] {
    raw = localStorage.getItem(board_key(team_id));
    if not raw { return empty_board(); }
    try {
        parsed = JSON.parse(raw) as dict[str, list[any]];
        return {"strokes": parsed["strokes"] if "strokes" in parsed else [], "notes": parsed["notes"] if "notes" in parsed else []};
    } except Exception { return empty_board(); }
}
def point_string(points: list[any]) -> str { return " ".join([str(point["x"] * 100) + "," + str(point["y"] * 150) for point in points]); }
def square_distance(a: any, b: any) -> float { return (a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2; }

def:pub WhiteboardPage() -> JsxPage {
    state = use_app_state(); active = None;
    for team in state["teams"] { if team.id == state["activeTeamId"] { active = team; break; } }
    active_id = active.id if active else "";
    has tool: str = "pen"; has color: str = BOARD_COLORS[1]; has width: int = BOARD_WIDTHS[1];
    has board: dict[str, list[any]] = empty_board(); has undo_stack: list[any] = [];
    has drawing: bool = False; has current_points: list[any] = [];
    has note_x: float = 0.0; has note_y: float = 0.0; has note_text: str = ""; has adding_note: bool = False;

    can with [active_id] entry {
        board = load_board(active_id) if active_id else empty_board(); undo_stack = []; drawing = False; current_points = []; adding_note = False;
    }
    def persist(next_board: dict[str, list[any]]) { board = next_board; if active_id { localStorage.setItem(board_key(active_id), JSON.stringify(next_board)); } }
    def remember(next_board: dict[str, list[any]]) { undo_stack = undo_stack + [board]; persist(next_board); }
    def event_point(event: any) -> dict[str, float] {
        rect = event.currentTarget.getBoundingClientRect();
        x = max(0.0, min(1.0, (event.clientX - rect.left) / rect.width));
        y = max(0.0, min(1.0, (event.clientY - rect.top) / rect.height));
        return {"x": x, "y": y};
    }
    def erase_near(point: dict[str, float]) {
        kept: list[any] = [];
        for stroke in board["strokes"] {
            close = any([square_distance(point, item) < 0.003 for item in stroke["points"]]);
            if not close { kept.append(stroke); }
        }
        if len(kept) != len(board["strokes"]) { remember({"strokes": kept, "notes": board["notes"]}); }
    }
    def pointer_down(event: any) {
        if not active_id { return; }
        point = event_point(event);
        if tool == "text" { note_x = point["x"]; note_y = point["y"]; note_text = ""; adding_note = True; return; }
        if tool == "erase" { erase_near(point); return; }
        event.currentTarget.setPointerCapture(event.pointerId); drawing = True; current_points = [point];
    }
    def pointer_move(event: any) { if drawing { current_points = current_points + [event_point(event)]; } }
    def pointer_up {
        if not drawing { return; }
        drawing = False;
        if current_points {
            stroke = {"id": str(Date.now()) + "-" + str(Math.random()), "color": color, "width": width, "points": current_points};
            remember({"strokes": board["strokes"] + [stroke], "notes": board["notes"]}); current_points = [];
        }
    }
    def commit_note {
        trimmed = note_text.strip(); adding_note = False;
        if not trimmed { return; }
        note = {"id": str(Date.now()) + "-" + str(Math.random()), "x": note_x, "y": note_y, "text": trimmed, "color": color};
        remember({"strokes": board["strokes"], "notes": board["notes"] + [note]}); note_text = "";
    }
    def undo {
        if not undo_stack { return; }
        previous = undo_stack[-1]; undo_stack = undo_stack[:-1]; persist(previous);
    }
    def clear_board { if board["strokes"] or board["notes"] { remember(empty_board()); } }
    team_name = active.name if active else "your team";
    display_strokes = board["strokes"] + ([{"id": "current", "color": color, "width": width, "points": current_points}] if drawing else []);

    <section className="whiteboard-page"><aside className="whiteboard-tools"><div><h1>Whiteboard</h1><p>Draw tactics for {team_name}. Changes stay on this device.</p></div>
        <div className="tool-buttons" role="group" aria-label="Drawing tool">{[<button key={item} className={"button primary small" if tool == item else "button secondary small"} onClick={lambda { tool = item; }}>{"Note" if item == "text" else item.title()}</button> for item in ["pen", "erase", "text"]]}</div>
        <div className="swatches" role="group" aria-label="Ink color">{[<button key={swatch} type="button" title={"Color " + swatch} aria-label={"Color " + swatch} className={"swatch selected" if color == swatch else "swatch"} style={{"backgroundColor": swatch}} onClick={lambda { color = swatch; if tool == "erase" { tool = "pen"; } }}></button> for swatch in BOARD_COLORS]}</div>
        <div className="widths" role="group" aria-label="Line thickness">{[<button key={size} type="button" aria-label={str(size) + " pixel line"} className={"width-button selected" if width == size else "width-button"} onClick={lambda { width = size; }}><span style={{"width": str(size) + "px", "height": str(size) + "px"}}></span></button> for size in BOARD_WIDTHS]}</div>
        <button className="button secondary small" disabled={not bool(undo_stack)} onClick={undo}>Undo</button><button className="button danger small" disabled={not bool(board["strokes"] or board["notes"])} onClick={clear_board}>Clear</button>
    </aside>
    <div className="board-wrap"><svg className="tactics-board" viewBox="0 0 100 150" preserveAspectRatio="none" onPointerDown={pointer_down} onPointerMove={pointer_move} onPointerUp={pointer_up} onPointerCancel={pointer_up}>
        <rect width="100" height="150" fill="#2e7d4f"></rect><path className="pitch-stripes" d="M0 18.75h100v9.375H0zm0 37.5h100v9.375H0zm0 37.5h100v9.375H0zm0 37.5h100v9.375H0z"></path>
        <g className="pitch-lines" fill="none"><rect x="3" y="3" width="94" height="144"></rect><line x1="3" y1="75" x2="97" y2="75"></line><circle cx="50" cy="75" r="9"></circle><circle cx="50" cy="75" r="0.8" fill="white"></circle><rect x="30" y="128" width="40" height="19"></rect><rect x="40" y="141" width="20" height="6"></rect><path d="M38 128 A12 12 0 0 1 62 128"></path><rect x="30" y="3" width="40" height="19"></rect><rect x="40" y="3" width="20" height="6"></rect><path d="M38 22 A12 12 0 0 0 62 22"></path></g>
        <g className="draw-layer">{[<polyline key={stroke["id"]} points={point_string(stroke["points"])} stroke={stroke["color"]} strokeWidth={stroke["width"] / 3} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"></polyline> for stroke in display_strokes]}</g>
    </svg>
    {[<div key={note["id"]} className="board-note" style={{"left": str(note["x"] * 100) + "%", "top": str(note["y"] * 100) + "%", "color": note["color"]}}>{note["text"]}</div> for note in board["notes"]]}
    {<form className="note-editor" style={{"left": str(note_x * 100) + "%", "top": str(note_y * 100) + "%"}} onSubmit={lambda (event: any) { event.preventDefault(); commit_note(); }}><input autoFocus className="input" placeholder="Instruction" value={note_text} onChange={lambda (e: ChangeEvent) { note_text = e.target.value; }} /><div><button type="button" className="button ghost small" onClick={lambda { adding_note = False; }}>Cancel</button><button type="submit" className="button primary small">Add</button></div></form> if adding_note else None}
    </div></section>
}
