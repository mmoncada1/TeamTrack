import "./lineups.css";
import from ..domain.formations { default_formation_for_format, formation_by_id, formations_for_format }
import from ..domain.lineups { clear_slot, fill_formation, move_assignment, move_breaks_coed_rule }
import from ..domain.roster { clamp_min_girls }
import from ..state.AppState { use_app_state }

def:pub LineupsPage() -> JsxPage {
    state = use_app_state(); active = None;
    for item in state["teams"] { if item.id == state["activeTeamId"] { active = item; break; } }
    team_players = [player for player in state["players"] if active and player.team_id == active.id];
    team_lineups = [lineup for lineup in state["lineups"] if active and lineup.team_id == active.id];
    has editing: bool = False; has editing_id: str = ""; has name: str = ""; has format: str = "7v7";
    has formation_id: str = "7v7-2-3-1"; has assignments: dict[str, str] = {}; has error: str = ""; has notice: str = "";
    formation = formation_by_id(formation_id);

    def start_new {
        initial_formation = default_formation_for_format("7v7"); editing_id = ""; name = ""; format = "7v7";
        formation_id = initial_formation.id; assignments = {}; error = ""; notice = ""; editing = True;
    }
    def start_edit(lineup: any) {
        editing_id = lineup.id; name = lineup.name; format = lineup.format; formation_id = lineup.formation_id;
        assignments = lineup.assignments.copy(); error = ""; notice = ""; editing = True;
    }
    def change_format(next_format: str) {
        initial_formation = default_formation_for_format(next_format); format = next_format; formation_id = initial_formation.id;
        assignments = {}; notice = "Formation reset for the new format.";
    }
    def change_formation(next_id: str) { formation_id = next_id; assignments = {}; notice = "Positions cleared for the new formation."; }
    def auto_fill {
        if not active { return; }
        if not formation { return; }
        minimum: int | None = clamp_min_girls(active.min_girls_on_field) if active.coed else None;
        result = fill_formation(formation, team_players, minimum); assignments = result.assignments; notice = result.summary;
    }
    def assign(slot: str, player_id: str) {
        if not active { return; }
        next_assignments = clear_slot(assignments, slot) if not player_id else move_assignment(assignments, player_id, slot);
        if active.coed and move_breaks_coed_rule(team_players, assignments, next_assignments, clamp_min_girls(active.min_girls_on_field)) {
            notice = "Too many guys on the field. Place the required girls first."; return;
        }
        assignments = next_assignments; notice = "";
    }
    def drop_on_slot(slot: str, event: any) {
        event.preventDefault(); player_id = event.dataTransfer.getData("text/plain");
        if any([player.id == player_id and player.availability == "active" for player in team_players]) { assign(slot, player_id); }
    }
    def drop_on_bench(event: any) {
        event.preventDefault(); player_id = event.dataTransfer.getData("text/plain");
        for (slot, assigned_id) in assignments.items() { if assigned_id == player_id { assign(slot, ""); return; } }
    }
    def save {
        result = state["saveLineup"].call(None, editing_id, name, format, formation_id, assignments);
        if result { error = result; } else { editing = False; }
    }
    def remove(lineup: any) {
        if window.confirm("Delete " + lineup.name + "? Matches that used it keep their own lineup.") { state["deleteLineup"].call(None, lineup.id); }
    }
    def player_name(id: str) -> str {
        for player in team_players { if player.id == id { return player.name; } }
        return "Unknown player";
    }

    def formation_shape(id: str) -> str {
        found = formation_by_id(id);
        if found { return found.shape; }
        return id;
    }

    if editing and formation {
        assigned_ids = list(assignments.values()); bench = [player for player in team_players if player.id not in assigned_ids];
        return <section className="page lineup-editor"><div className="title-row"><h1>{"Edit lineup" if editing_id else "New lineup"}</h1><button className="button ghost" onClick={lambda { editing = False; }}>Back to lineups</button></div>
            <div className="lineup-controls"><label>Lineup name<input className="input" placeholder="e.g. Strong start" value={name} onChange={lambda (e: ChangeEvent) { name = e.target.value; }} /></label>
                <label>Formation<select className="input" value={formation_id} onChange={lambda (e: ChangeEvent) { change_formation(e.target.value); }}>{[<option key={item.id} value={item.id}>{item.shape}</option> for item in formations_for_format(format)]}</select></label></div>
            <div className="format-row" role="radiogroup" aria-label="Match format">{[<button key={item} type="button" role="radio" aria-checked={format == item} className={"format active" if format == item else "format"} onClick={lambda { change_format(item); }}>{item}</button> for item in ["7v7", "9v9", "11v11"]]}
                <button className="button secondary small" type="button" onClick={auto_fill}>Auto-fill by position</button><span>{len(assignments)}/{len(formation.positions)} placed</span></div>
            {<p className="notice" role="status">{notice}</p> if notice else None}
            <div className="formation-board"><div className="pitch"><div className="center-line"></div>{[<div className="position-slot" key={position.id} draggable={position.id in assignments} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", assignments[position.id]); }} onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={lambda (e: any) { drop_on_slot(position.id, e); }} style={{"left": str(position.x) + "%", "top": str(position.y) + "%"}}>
                <span>{position.label}</span><select value={assignments[position.id] if position.id in assignments else ""} onChange={lambda (e: ChangeEvent) { assign(position.id, e.target.value); }}>
                    <option value="">Open</option>{[<option key={player.id} value={player.id}>{("#" + str(player.jersey_number) + " " if player.jersey_number is not None else "") + player.name}</option> for player in team_players if player.availability == "active"]}</select>
            </div> for position in formation.positions]}</div>
                <aside className="bench" onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={drop_on_bench}><h2>Bench</h2>{[<button type="button" key={player.id} draggable={player.availability == "active"} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", player.id); }} onClick={lambda { notice = "Choose a field slot to place " + player.name + "."; }}>{player.name}</button> for player in bench]}{<p>No players on bench.</p> if not bench else None}</aside></div>
            {<p className="error" role="alert">{error}</p> if error else None}<div className="actions"><button className="button ghost" onClick={lambda { editing = False; }}>Cancel</button><button className="button primary" onClick={save}>{"Save changes" if editing_id else "Save lineup"}</button></div>
        </section>;
    }

    <section className="page lineups-page"><div className="title-row"><div><h1>Lineups</h1><p className="muted">Build starting lineups ahead of time, then pick one when creating a match.</p></div><button className="button primary" onClick={start_new} disabled={not bool(active)}>+ New lineup</button></div>
        {<p className="empty-card">No saved lineups yet. Create one and it will be available when you set up a match.</p> if not team_lineups else None}
        <ul className="saved-lineups">{[<li key={lineup.id}><div><strong>{lineup.name}</strong><p>{lineup.format} · {formation_shape(lineup.formation_id)} · {len(lineup.assignments)} players</p><small>{", ".join([player_name(id) for id in lineup.assignments.values()])}</small></div><div><button className="button secondary small" onClick={lambda { start_edit(lineup); }}>Edit</button><button className="button ghost small" onClick={lambda { remove(lineup); }}>Delete</button></div></li> for lineup in team_lineups]}</ul>
    </section>
}
