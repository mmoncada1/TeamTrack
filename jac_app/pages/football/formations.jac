import "./football.css";
import from "@jac/runtime" { Link }
import from ...state.AppState { use_app_state }
import from ...state.storage { create_id }
import from ...football.domain { new_formation, autofill_from_roster }

def:pub FootballFormationsPage() -> JsxPage {
    state = use_app_state(); active = None;
    for team in state["teams"] { if team.id == state["activeTeamId"] { active = team; break; } }
    has draft: any = None; has error: str = "";
    formations = [item for item in state["footballFormations"] if active and item.team_id == active.id];
    roster = [player for player in state["players"] if active and player.team_id == active.id and player.availability == "active"];

    def new_draft {
        if not active { return; }
        ids = [create_id("slot") for _ in range(7)];
        draft = new_formation(active.id, create_id("formation"), ids, int(Date.now())); error = "";
    }
    def edit(item: any) { draft = structuredClone(item); error = ""; }
    def assign_player(slot_id: str, player_id: str) {
        if draft is None { return; }
        updated = structuredClone(draft);
        for slot in updated.players { if slot.roster_player_id == player_id and player_id { slot.roster_player_id = None; } }
        for slot in updated.players { if slot.id == slot_id { slot.roster_player_id = player_id if player_id else None; } }
        draft = updated;
    }
    def move_slot(slot_id: str, axis: str, value: str) {
        if draft is None { return; }
        try { coordinate = max(0.0, min(100.0, float(value))); }
        except Exception { return; }
        updated = structuredClone(draft);
        for slot in updated.players {
            if slot.id == slot_id {
                if axis == "x" { slot.position.x = coordinate; }
                else { slot.position.y = coordinate; }
            }
        }
        draft = updated;
    }
    def drop_slot(event: any) {
        event.preventDefault(); if draft is None { return; }
        slot_id = event.dataTransfer.getData("text/plain"); rect = event.currentTarget.getBoundingClientRect();
        x = max(0.0, min(100.0, (event.clientX - rect.left) * 100 / rect.width));
        y = max(0.0, min(100.0, (event.clientY - rect.top) * 100 / rect.height));
        updated = structuredClone(draft);
        for slot in updated.players { if slot.id == slot_id { slot.position.x = x; slot.position.y = y; } }
        draft = updated;
    }
    def save {
        if draft is None { return; }
        updated = structuredClone(draft); updated.updated_at = int(Date.now());
        result = state["saveFootballFormation"].call(None, updated); error = result;
        if not result { draft = None; }
    }
    def remove(item: any) {
        if window.confirm("Delete formation " + item.name + "? Saved plays keep their snapshots.") {
            state["deleteFootballFormation"].call(None, item.id);
        }
    }
    if not active or active.sport != "football" { return <section className="page narrow-page"><h1>Football formations</h1><p>Choose a football team first.</p><Link to="/">Dashboard</Link></section>; }
    if draft is not None {
        return <section className="page football-page"><div className="title-row"><h1>{"Edit formation" if any([item.id == draft.id for item in formations]) else "New formation"}</h1><button className="button ghost" onClick={lambda { draft = None; }}>Back</button></div>
            <div className="card form-stack"><label>Name<input className="input" value={draft.name} onChange={lambda (e: ChangeEvent) { updated = structuredClone(draft); updated.name = e.target.value; draft = updated; }} /></label>
                <div className="football-field" aria-label="Football formation preview" onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={drop_slot}>{[<div className="football-token" key={slot.id} draggable={True} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", slot.id); }} style={{"left": str(slot.position.x) + "%", "top": str(slot.position.y) + "%"}}><strong>{slot.label}</strong><small>{"QB" if slot.id == draft.quarterback_id else "Snapper" if slot.id == draft.snapper_id else ""}</small></div> for slot in draft.players]}</div>
                <div className="football-slot-list">{[<div className="football-slot-row" key={slot.id}><label>Label<input className="input" value={slot.label} onChange={lambda (e: ChangeEvent) { updated = structuredClone(draft); for player_slot in updated.players { if player_slot.id == slot.id { player_slot.label = e.target.value; } } draft = updated; }} /></label><label>Player<select className="input" value={slot.roster_player_id or ""} onChange={lambda (e: ChangeEvent) { assign_player(slot.id, e.target.value); }}><option value="">Unassigned</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in roster]}</select></label><label>X<input className="input" type="number" min="0" max="100" value={slot.position.x} onChange={lambda (e: ChangeEvent) { move_slot(slot.id, "x", e.target.value); }} /></label><label>Y<input className="input" type="number" min="0" max="100" value={slot.position.y} onChange={lambda (e: ChangeEvent) { move_slot(slot.id, "y", e.target.value); }} /></label></div> for slot in draft.players]}</div>
                <div className="football-role-row"><label>Quarterback<select className="input" value={draft.quarterback_id} onChange={lambda (e: ChangeEvent) { updated = structuredClone(draft); updated.quarterback_id = e.target.value; draft = updated; }}>{[<option key={slot.id} value={slot.id}>{slot.label}</option> for slot in draft.players]}</select></label><label>Snapper<select className="input" value={draft.snapper_id} onChange={lambda (e: ChangeEvent) { updated = structuredClone(draft); updated.snapper_id = e.target.value; draft = updated; }}>{[<option key={slot.id} value={slot.id}>{slot.label}</option> for slot in draft.players]}</select></label></div>
                {<p className="error" role="alert">{error}</p> if error else None}<div className="actions"><button className="button secondary" type="button" onClick={lambda { draft = autofill_from_roster(draft, roster, int(Date.now())); }}>Autofill from roster</button><button className="button primary" type="button" onClick={save}>Save formation</button></div>
            </div></section>;
    }
    <section className="page football-page"><div className="title-row"><div><h1>Football formations</h1><p className="muted">Seven offensive slots with separate QB and snapper roles.</p></div><button className="button primary" type="button" onClick={new_draft}>New formation</button></div><div className="football-cards">{[<article className="card" key={item.id}><h2>{item.name}</h2><p>{len([slot for slot in item.players if slot.roster_player_id])}/7 roster players assigned</p><div className="actions"><button className="button secondary small" onClick={lambda { edit(item); }}>Edit</button><button className="button ghost small" onClick={lambda { remove(item); }}>Delete</button></div></article> for item in formations]}</div>{<p className="empty-card">Create your first seven-player formation.</p> if not formations else None}</section>
}
