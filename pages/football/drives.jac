import "./football.css";
import from "@jac/runtime" { Link }
import from ...state.AppState { use_app_state }
import from ...state.storage { create_id }
import from ...football.models { DrivePlan, DriveEntry }
import from ...football.domain { move_drive_entry }
import from ...components.FootballField { FootballField }

def:pub FootballDrivePlansPage() -> JsxPage {
    state = use_app_state(); active = None;
    for team in state["teams"] { if team.id == state["activeTeamId"] { active = team; break; } }
    plans = [item for item in state["drivePlans"] if active and item.team_id == active.id];
    plays = [item for item in state["footballPlays"] if active and item.team_id == active.id];
    roster = [item for item in state["players"] if active and item.team_id == active.id];
    has draft: any = None; has saved_snapshot: str = ""; has undo_stack: list[any] = []; has redo_stack: list[any] = [];
    has play_id: str = ""; has index: int = 0; has message: str = "";
    active_id = active.id if active else "";
    can with [active_id] entry { draft = None; undo_stack = []; redo_stack = []; message = ""; }
    dirty = draft is not None and JSON.stringify(draft) != saved_snapshot;
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
    def play_name(id: str) -> str {
        for play in plays { if play.id == id { return play.name; } }
        return "Missing play";
    }
    def open_plan(item: any) {
        draft = structuredClone(item); saved_snapshot = JSON.stringify(item); undo_stack = []; redo_stack = []; index = 0; play_id = ""; message = "";
    }
    def new_plan {
        if not active { return; }
        now = int(Date.now()); open_plan(DrivePlan(id=create_id("drive"), team_id=active.id, name="Drive 1", entries=[], created_at=now, updated_at=now));
    }
    def change(next_plan: any) { undo_stack = undo_stack + [structuredClone(draft)]; redo_stack = []; draft = next_plan; message = ""; }
    def undo { if undo_stack { redo_stack = redo_stack + [draft]; draft = undo_stack[-1]; undo_stack = undo_stack[:-1]; } }
    def redo { if redo_stack { undo_stack = undo_stack + [draft]; draft = redo_stack[-1]; redo_stack = redo_stack[:-1]; } }
    def close_editor { if JSON.stringify(draft) == saved_snapshot or window.confirm("Discard unsaved drive edits?") { draft = None; } }
    def save {
        updated = structuredClone(draft); updated.updated_at = int(Date.now());
        result = state["saveDrivePlan"].call(None, updated); message = result if result else "Drive saved.";
        if not result { draft = updated; saved_snapshot = JSON.stringify(updated); }
    }
    def add_play {
        if not any([play.id == play_id for play in plays]) { return; }
        updated = structuredClone(draft); updated.entries = updated.entries + [DriveEntry(id=create_id("call"), play_id=play_id)]; change(updated); index = len(updated.entries) - 1;
    }
    def move_entry(from_index: int, to_index: int) {
        updated = structuredClone(draft); updated.entries = move_drive_entry(updated.entries, from_index, to_index); change(updated); index = to_index;
    }
    def repeat_entry(at: int) {
        updated = structuredClone(draft); call = updated.entries[at];
        updated.entries = updated.entries[:at + 1] + [DriveEntry(id=create_id("call"), play_id=call.play_id)] + updated.entries[at + 1:]; change(updated); index = at + 1;
    }
    def remove_entry(id: str) {
        updated = structuredClone(draft); updated.entries = [call for call in updated.entries if call.id != id]; change(updated); index = min(index, max(0, len(updated.entries) - 1));
    }
    def remove_plan(item: any) { if window.confirm("Delete " + item.name + "?") { state["deleteDrivePlan"].call(None, item.id); } }
    if not active or active.sport != "football" { return <section className="page narrow-page"><h1>Drive plans</h1><p>Choose a football team first.</p><Link to="/">Dashboard</Link></section>; }
    if draft is not None {
        current_index = min(index, max(0, len(draft.entries) - 1)); current = None;
        if draft.entries { for play in plays { if play.id == draft.entries[current_index].play_id { current = play; break; } } }
        return <section className="page football-page football-drives"><div className="title-row"><h1>Drive planner</h1><div className="actions"><button className="button secondary" onClick={close_editor}>Back</button><button className="button primary" onClick={save}>Save drive</button></div></div><label>Drive name<input className="input" value={draft.name} onChange={lambda (e: ChangeEvent) { updated = structuredClone(draft); updated.name = e.target.value; change(updated); }} /></label>{<p role="status">{message}</p> if message else None}<div className="football-drive-controls"><select aria-label="Play to add" className="input" value={play_id} onChange={lambda (e: ChangeEvent) { play_id = e.target.value; }}><option value="">Choose play</option>{[<option key={play.id} value={play.id}>{play.name}</option> for play in plays]}</select><button className="button secondary" disabled={not bool(play_id)} onClick={add_play}>Add play</button><button className="button ghost" disabled={not bool(undo_stack)} onClick={undo}>Undo</button><button className="button ghost" disabled={not bool(redo_stack)} onClick={redo}>Redo</button></div><div className="football-drive-grid"><ol className="football-drive-list">{[<li key={call.id} className={"football-drive-call selected" if at == current_index else "football-drive-call"}><button className="button ghost small" onClick={lambda { index = at; }}>{str(at + 1) + ". " + play_name(call.play_id)}</button><button className="button ghost small" aria-label={"Move play " + str(at + 1) + " up"} disabled={at == 0} onClick={lambda { move_entry(at, at - 1); }}>↑</button><button className="button ghost small" aria-label={"Move play " + str(at + 1) + " down"} disabled={at == len(draft.entries) - 1} onClick={lambda { move_entry(at, at + 1); }}>↓</button><button className="button secondary small" onClick={lambda { repeat_entry(at); }}>Repeat</button><button className="button ghost small" onClick={lambda { remove_entry(call.id); }}>Remove</button></li> for (at, call) in enumerate(draft.entries)]}</ol>{<section className="football-drive-preview"><div className="actions"><button className="button ghost" disabled={current_index == 0} onClick={lambda { index = max(0, current_index - 1); }}>Previous</button><span>{str(current_index + 1) + " / " + str(len(draft.entries))}</span><button className="button ghost" disabled={current_index == len(draft.entries) - 1} onClick={lambda { index = min(len(draft.entries) - 1, current_index + 1); }}>Next</button></div><h2>{current.name}</h2><FootballField item={current} roster={roster} drawings={current.drawings} actions={current.ball_actions} /><p>{current.description}</p><Link to={"/football/plays/" + current.id}>Open play editor</Link></section> if current else None}</div></section>;
    }
    <section className="page football-page football-drives"><div className="title-row"><h1>Drive plans</h1><button className="button primary" onClick={new_plan}>New drive plan</button></div><p className="muted">Build an ordered call sheet. Repeat a play as often as needed. Drive plans are separate from match tracking.</p>{<p>No drive plans yet.</p> if not plans else None}{[<article className="football-drive-card" key={plan.id}><div><h2>{plan.name}</h2><p className="muted">{" → ".join([play_name(call.play_id) for call in plan.entries]) if plan.entries else "Empty drive"}</p></div><div className="actions"><button className="button secondary" onClick={lambda { open_plan(plan); }}>Open drive</button><button className="button ghost" onClick={lambda { remove_plan(plan); }}>Delete</button></div></article> for plan in plans]}</section>
}
