import "./setup.css";
import from "@jac/runtime" { Link, useNavigate, useParams }
import from ....domain.models { ThresholdSetting }
import from ....domain.formations { default_formation_for_format, formation_by_id, formations_for_format }
import from ....domain.lineups { clear_slot, fill_formation, move_assignment, move_breaks_coed_rule }
import from ....domain.matches { standard_thresholds, validate_match_setup }
import from ....domain.roster { clamp_min_girls, jersey_label }
import from ....state.AppState { use_app_state }

def:pub MatchSetupPage() -> JsxPage {
    state = use_app_state(); params = useParams(); navigate = useNavigate(); id = str(params["id"]); game = None;
    for item in state["matches"] { if item.id == id { game = item; break; } }
    active = None; for team in state["teams"] { if game and team.id == game.team_id { active = team; break; } }
    team_players = [player for player in state["players"] if game and player.team_id == game.team_id];
    has loaded_id: str = ""; has team_name: str = ""; has opponent: str = ""; has date: str = "";
    has kickoff: str = ""; has title: str = ""; has format: str = "7v7"; has formation_id: str = "7v7-2-3-1";
    has half_length: str = "25"; has halves: str = "2"; has thresholds: dict[str, ThresholdSetting] = standard_thresholds();
    has goalkeeper_rotation: bool = False; has alert_sound: bool = False; has roster_ids: list[str] = [];
    has unavailable_ids: list[str] = []; has assignments: dict[str, str] = {}; has notice: str = ""; has saved: bool = False;
    match_id = game.id if game else "";
    can with [match_id] entry {
        if game {
            loaded_id = game.id; team_name = game.team_name; opponent = game.opponent_name; date = game.date;
            kickoff = game.kickoff_time or ""; title = game.title or ""; format = game.settings.format;
            formation_id = game.pending_formation_id; half_length = str(game.settings.half_length_minutes);
            halves = str(game.settings.number_of_halves); thresholds = game.settings.thresholds;
            goalkeeper_rotation = game.settings.goalkeeper_rotation_enabled; alert_sound = game.settings.alert_sound_enabled;
            roster_ids = game.roster_player_ids; unavailable_ids = game.unavailable_player_ids;
            assignments = game.pending_assignments; notice = ""; saved = False;
        }
    }
    formation = formation_by_id(formation_id);
    team_lineups = [lineup for lineup in state["lineups"] if game and lineup.team_id == game.team_id and lineup.format == format];
    selected_players = [player for player in team_players if player.id in roster_ids and player.id not in unavailable_ids];
    validation = validate_match_setup(team_name, opponent, date, format, formation_id,
        int(half_length) if half_length else 0, int(halves) if halves else 0, roster_ids, assignments);

    def change_format(next_format: str) {
        initial = default_formation_for_format(next_format); format = next_format; formation_id = initial.id;
        assignments = {}; notice = "Formation reset for the new format."; saved = False;
    }
    def change_formation(next_id: str) { formation_id = next_id; assignments = {}; notice = "Positions cleared for the new formation."; saved = False; }
    def toggle_roster(player_id: str, checked: bool) {
        if checked and player_id not in roster_ids { roster_ids = roster_ids + [player_id]; }
        elif not checked { roster_ids = [item for item in roster_ids if item != player_id]; unavailable_ids = [item for item in unavailable_ids if item != player_id]; assignments = {slot: assigned for (slot, assigned) in assignments.items() if assigned != player_id}; }
        saved = False;
    }
    def toggle_unavailable(player_id: str, checked: bool) {
        if checked and player_id not in unavailable_ids { unavailable_ids = unavailable_ids + [player_id]; assignments = {slot: assigned for (slot, assigned) in assignments.items() if assigned != player_id}; }
        elif not checked { unavailable_ids = [item for item in unavailable_ids if item != player_id]; }
        saved = False;
    }
    def set_threshold(group: str, enabled: bool, minutes: int) {
        thresholds = {**thresholds, group: ThresholdSetting(enabled=enabled, minutes=minutes)}; saved = False;
    }
    def auto_fill {
        if not formation or not active { return; }
        minimum: int | None = clamp_min_girls(active.min_girls_on_field) if active.coed else None;
        result = fill_formation(formation, selected_players, minimum); assignments = result.assignments; notice = result.summary; saved = False;
    }
    def apply_lineup(lineup_id: str) {
        for lineup in team_lineups {
            if lineup.id == lineup_id {
                formation_id = lineup.formation_id; assignments = lineup.assignments.copy();
                for assigned_id in assignments.values() { if assigned_id not in roster_ids { roster_ids = roster_ids + [assigned_id]; } }
                notice = "Loaded the '" + lineup.name + "' lineup."; saved = False; return;
            }
        }
    }
    def assign(slot: str, player_id: str) {
        next_assignments = clear_slot(assignments, slot) if not player_id else move_assignment(assignments, player_id, slot);
        if active and active.coed and move_breaks_coed_rule(selected_players, assignments, next_assignments, clamp_min_girls(active.min_girls_on_field)) {
            notice = "Too many guys on the field. Place the required girls first."; return;
        }
        assignments = next_assignments; saved = False;
    }
    def drop_on_slot(slot: str, event: any) {
        event.preventDefault(); player_id = event.dataTransfer.getData("text/plain");
        if any([player.id == player_id for player in selected_players]) { assign(slot, player_id); }
    }
    def drop_on_roster(event: any) {
        event.preventDefault(); player_id = event.dataTransfer.getData("text/plain");
        for (slot, assigned_id) in assignments.items() { if assigned_id == player_id { assign(slot, ""); return; } }
    }
    def persist {
        result = state["saveMatchSetup"].call(None, id, team_name, opponent, date, kickoff, title, format, formation_id,
            int(half_length) if half_length else 0, int(halves) if halves else 0, thresholds, goalkeeper_rotation,
            alert_sound, roster_ids, unavailable_ids, assignments, False);
        notice = result; saved = not bool(result);
    }

    def start_match {
        if validation.errors { return; }
        result = state["saveMatchSetup"].call(None, id, team_name, opponent, date, kickoff, title, format, formation_id,
            int(half_length) if half_length else 0, int(halves) if halves else 0, thresholds, goalkeeper_rotation,
            alert_sound, roster_ids, unavailable_ids, assignments, True);
        notice = result;
        if not result { navigate("/match/" + id + "/live"); }
    }
    if not game { return <section className="page narrow-page"><h1>Match not found</h1><Link to="/matches">Back to matches</Link></section>; }
    <section className="page match-setup"><div className="title-row"><h1>New match setup</h1><Link className="button ghost" to="/matches">Back to matches</Link></div>
        <div className="setup-grid"><label>Team name<input className="input" value={team_name} onChange={lambda (e: ChangeEvent) { team_name = e.target.value; saved = False; }} /></label>
            <label>Opponent name<input className="input" required value={opponent} onChange={lambda (e: ChangeEvent) { opponent = e.target.value; saved = False; }} /></label>
            <label>Match date<input className="input" type="date" value={date} onChange={lambda (e: ChangeEvent) { date = e.target.value; saved = False; }} /></label>
            <label>Kickoff time (optional)<input className="input" type="time" value={kickoff} onChange={lambda (e: ChangeEvent) { kickoff = e.target.value; saved = False; }} /></label>
            <label>Match title (optional)<input className="input" value={title} onChange={lambda (e: ChangeEvent) { title = e.target.value; saved = False; }} /></label></div>
        <section className="setup-section"><h2>Format and formation</h2><div className="format-row">{[<button type="button" key={item} className={"format active" if format == item else "format"} onClick={lambda { change_format(item); }}>{item}</button> for item in ["7v7", "9v9", "11v11"]]}</div>
            <label>Formation<select className="input compact" value={formation_id} onChange={lambda (e: ChangeEvent) { change_formation(e.target.value); }}>{[<option key={item.id} value={item.id}>{item.shape}</option> for item in formations_for_format(format)]}</select></label></section>
        <section className="setup-section"><h2>Match timing</h2><div className="setup-grid"><label>Half length (minutes)<input className="input" type="number" min="1" value={half_length} onChange={lambda (e: ChangeEvent) { half_length = e.target.value; saved = False; }} /></label>
            <label>Number of halves<select className="input" value={halves} onChange={lambda (e: ChangeEvent) { halves = e.target.value; saved = False; }}><option value="2">2 halves</option><option value="1">1 running clock</option></select></label></div></section>
        <section className="setup-section"><h2>Playing-time alerts</h2><div className="threshold-grid">{[<div className="threshold" key={group}><label className="check-row"><input type="checkbox" checked={thresholds[group].enabled} onChange={lambda (e: ChangeEvent) { set_threshold(group, e.target.checked, thresholds[group].minutes); }} /> {label}</label>
            <input type="range" min="1" max="30" value={thresholds[group].minutes} disabled={not thresholds[group].enabled} onChange={lambda (e: ChangeEvent) { set_threshold(group, thresholds[group].enabled, int(e.target.value)); }} /><span>{thresholds[group].minutes} min</span></div>
            for (group, label) in [("GK", "Goalkeeper"), ("DEF", "Defender"), ("MID", "Midfielder"), ("FWD", "Forward")]]}</div>
            <label className="check-row"><input type="checkbox" checked={goalkeeper_rotation} onChange={lambda (e: ChangeEvent) { goalkeeper_rotation = e.target.checked; saved = False; }} /> Enable goalkeeper rotation alerts</label>
            <label className="check-row"><input type="checkbox" checked={alert_sound} onChange={lambda (e: ChangeEvent) { alert_sound = e.target.checked; saved = False; }} /> Enable alert sound</label></section>
        <section className="setup-section"><h2>Roster for this match</h2><div className="match-roster" onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={drop_on_roster}>{[<div key={player.id} draggable={player.id in roster_ids and player.id not in unavailable_ids} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", player.id); }}><label className="check-row"><input type="checkbox" checked={player.id in roster_ids} onChange={lambda (e: ChangeEvent) { toggle_roster(player.id, e.target.checked); }} /> {jersey_label(player.jersey_number)} {player.name}</label>
            {<label className="check-row unavailable"><input type="checkbox" checked={player.id in unavailable_ids} onChange={lambda (e: ChangeEvent) { toggle_unavailable(player.id, e.target.checked); }} /> Unavailable</label> if player.id in roster_ids else None}</div> for player in team_players]}</div></section>
        <section className="setup-section"><h2>Starting lineup</h2><div className="lineup-actions"><select className="input compact" value="" onChange={lambda (e: ChangeEvent) { apply_lineup(e.target.value); }}><option value="">{"Choose a saved lineup…" if team_lineups else "No saved lineups yet"}</option>{[<option key={lineup.id} value={lineup.id}>{lineup.name}</option> for lineup in team_lineups]}</select>
            <button className="button secondary" type="button" onClick={auto_fill}>Auto-fill by position</button><Link className="button ghost" to="/lineups">Manage lineups</Link></div>
            {<p className="notice">{notice}</p> if notice else None}
            {<div className="setup-pitch">{[<div className="setup-slot" key={position.id} draggable={position.id in assignments} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", assignments[position.id]); }} onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={lambda (e: any) { drop_on_slot(position.id, e); }} style={{"left": str(position.x) + "%", "top": str(position.y) + "%"}}><span>{position.label}</span><select value={assignments[position.id] if position.id in assignments else ""} onChange={lambda (e: ChangeEvent) { assign(position.id, e.target.value); }}><option value="">Open</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in selected_players]}</select></div> for position in formation.positions]}</div> if formation else None}</section>
        <section className="validation">{[<p className="error" key={idx}>{message}</p> for (idx, message) in enumerate(validation.errors)]}{[<p className="warning" key={idx}>{message}</p> for (idx, message) in enumerate(validation.warnings)]}</section>
        {<p className="success">Match setup saved.</p> if saved else None}<div className="actions"><button className="button secondary" type="button" onClick={persist}>Save draft</button><button className="button primary" type="button" disabled={bool(validation.errors)} onClick={start_match}>Start match</button></div>
    </section>
}
