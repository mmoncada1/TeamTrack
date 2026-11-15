import "../../lineups.css";
import from ....components.LineupToken { LineupToken }
import from ....components.EmptyPosition { EmptyPosition }
import "./setup.css";
import from "@jac/runtime" { Link, useNavigate, useParams }
import from ....domain.models { ThresholdSetting }
import from ....domain.formations { default_formation_for_format, formation_by_id, formations_for_format }
import from ....domain.lineups { clear_slot, fill_formation, move_assignment, move_breaks_coed_rule }
import from ....domain.matches { standard_thresholds }
import from ....domain.roster { clamp_min_girls }
import from ....state.AppState { use_app_state }

def jersey_label(number: int | None) -> str { return "" if number is None else "#" + str(number); }

def positive_minutes(value: str) -> int {
    try { return int(value); } except Exception { return 0; }
}

def validate_match_setup(team_name: str, opponent_name: str, date: str, format: str,
    half_length_minutes: int, number_of_halves: int, roster_player_ids: list[str],
    assignments: dict[str, str], formation: any) -> dict[str, any] {
    errors: list[str] = []; warnings: list[str] = [];
    if not team_name.strip() { errors.append("Team name is required."); }
    if not opponent_name.strip() { errors.append("Opponent name is required."); }
    if not date { errors.append("Match date is required."); }
    if format not in ["7v7", "9v9", "11v11"] { errors.append("Select a valid match format."); }
    if formation is None { errors.append("Select a valid formation."); }
    elif formation.format != format { errors.append("Formation does not match the selected format."); }
    if half_length_minutes <= 0 { errors.append("Half length must be a positive number of minutes."); }
    if number_of_halves not in [1, 2] { errors.append("Number of halves must be 1 or 2."); }
    max_players = 7 if format == "7v7" else 9 if format == "9v9" else 11;
    if len(assignments) > max_players { errors.append("Too many players assigned to the field: " + str(len(assignments)) + " assigned, but " + format + " allows " + str(max_players) + "."); }
    assigned_ids: list[str] = [];
    for assigned_id in assignments.values() { assigned_ids.append(assigned_id); }
    seen: list[str] = [];
    for assigned_id in assigned_ids { if assigned_id in seen { errors.append("A player is assigned to multiple positions."); break; } seen.append(assigned_id); }
    for player_id in assigned_ids {
        if player_id not in roster_player_ids { errors.append("A field assignment includes a player who is not selected for this match."); break; }
    }
    if len(assignments) == 0 { warnings.append("No players are assigned to the field yet."); }
    elif len(assignments) < max_players { warnings.append("Only " + str(len(assignments)) + " of " + str(max_players) + " field positions are filled. The team will be short-handed."); }
    return {"errors": errors, "warnings": warnings};
}

def:pub MatchSetupPage() -> JsxPage {
    state = use_app_state(); params = useParams(); navigate = useNavigate(); id = str(params["id"]); game = None;
    for item in state["matches"] { if item.id == id { game = item; break; } }
    active = None; for team in state["teams"] { if game and team.id == game.team_id { active = team; break; } }
    team_players = [player for player in state["players"] if game and player.team_id == game.team_id];
    has loaded_id: str = ""; has team_name: str = ""; has opponent: str = ""; has date: str = "";
    has kickoff: str = ""; has title: str = ""; has format: str = "7v7"; has formation_id: str = "7v7-2-3-1";
    has half_length: str = "25"; has halves: str = "2"; has thresholds: dict[str, ThresholdSetting] = standard_thresholds(); has minimum_playing_time: str = "10"; has assistant_accept_seconds: str = "5";
    has goalkeeper_rotation: bool = False; has alert_sound: bool = False; has roster_ids: list[str] = [];
    has unavailable_ids: list[str] = []; has assignments: dict[str, str] = {}; has notice: str = ""; has saved: bool = False; has attempted: bool = False; has notice_error: bool = False;
    match_id = game.id if game else "";
    can with [match_id] entry {
        if game {
            loaded_id = game.id; team_name = game.team_name; opponent = game.opponent_name; date = game.date;
            kickoff = game.kickoff_time or ""; title = game.title or ""; format = game.settings.format;
            formation_id = game.pending_formation_id; half_length = str(game.settings.half_length_minutes);
            halves = str(game.settings.number_of_halves); thresholds = game.settings.thresholds; minimum_playing_time = str(game.settings.minimum_playing_time_minutes); assistant_accept_seconds = str(game.settings.assistant_accept_seconds or 5);
            goalkeeper_rotation = game.settings.goalkeeper_rotation_enabled; alert_sound = game.settings.alert_sound_enabled;
            roster_ids = game.roster_player_ids; unavailable_ids = game.unavailable_player_ids;
            assignments = game.pending_assignments; notice = ""; saved = False; attempted = False;
        }
    }
    formation = formation_by_id(formation_id);
    team_lineups = [lineup for lineup in state["lineups"] if game and lineup.team_id == game.team_id and lineup.format == format];
    selected_players = [player for player in team_players if player.id in roster_ids and player.id not in unavailable_ids];
    validation = validate_match_setup(team_name, opponent, date, format,
        positive_minutes(half_length), positive_minutes(halves), roster_ids, assignments, formation);

    def change_format(next_format: str) {
        notice_error = False;
        initial = default_formation_for_format(next_format); format = next_format; formation_id = initial.id;
        assignments = {}; notice = "Formation reset for the new format."; saved = False;
    }
    def change_formation(next_id: str) { notice_error = False; formation_id = next_id; assignments = {}; notice = "Positions cleared for the new formation."; saved = False; }
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
        notice_error = False;
        if not formation or not active { return; }
        minimum: int | None = clamp_min_girls(active.min_girls_on_field) if active.coed else None;
        result = fill_formation(formation, selected_players, minimum); assignments = result.assignments; notice = result.summary; saved = False;
    }
    def apply_lineup(lineup_id: str) {
        notice_error = False;
        for lineup in team_lineups {
            if lineup.id == lineup_id {
                formation_id = lineup.formation_id; assignments = lineup.assignments.copy();
                for assigned_id in assignments.values() { if assigned_id not in roster_ids { roster_ids = roster_ids + [assigned_id]; } }
                notice = "Loaded the '" + lineup.name + "' lineup."; saved = False; return;
            }
        }
    }
    def assign(slot: str, player_id: str) {
        notice_error = False;
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
        attempted = True;
        result = state["saveMatchSetup"].call(None, id, team_name, opponent, date, kickoff, title, format, formation_id,
            positive_minutes(half_length), positive_minutes(halves), thresholds, goalkeeper_rotation,
            alert_sound, roster_ids, unavailable_ids, assignments, positive_minutes(minimum_playing_time), False, positive_minutes(assistant_accept_seconds));
        notice = result; notice_error = bool(result); saved = not bool(result);
    }

    def start_match {
        attempted = True;
        if bool(validation["errors"]) { notice = validation["errors"][0]; return; }
        try {
            result = state["saveMatchSetup"].call(None, id, team_name, opponent, date, kickoff, title, format, formation_id,
                positive_minutes(half_length), positive_minutes(halves), thresholds, goalkeeper_rotation,
                alert_sound, roster_ids, unavailable_ids, assignments, positive_minutes(minimum_playing_time), True, positive_minutes(assistant_accept_seconds));
        } except Exception as error { notice = "Could not start match: " + str(error); notice_error = True; return; }
        notice = result; notice_error = bool(result);
        if not result { navigate("/match/" + id + "/live"); }
    }
    if not game { return <section className="page narrow-page"><h1>Match not found</h1><Link to="/matches">Back to matches</Link></section>; }
    alert_labels = [("GK", "Goalkeeper"), ("DEF", "Defender"), ("MID", "Midfielder"), ("FWD", "Forward")];
    shown_errors = validation["errors"] if attempted else []; shown_warnings = validation["warnings"] if attempted else [];
    <section className="page match-setup">
        <div className="setup-header"><div><Link className="setup-back" to="/matches">← Matches</Link><h1>Match setup</h1></div>
            <div className="setup-header-actions"><button className="button secondary" type="button" onClick={persist}>Save draft</button><button className="button primary" type="button" onClick={start_match}>Start match</button></div></div>
        {<div className="setup-status">{[<p className="error" key={"e" + str(idx)}>{message}</p> for (idx, message) in enumerate(shown_errors)]}{[<p className="warning" key={"w" + str(idx)}>{message}</p> for (idx, message) in enumerate(shown_warnings)]}{<p className={"error" if notice_error else "setup-notice"} role="status">{notice}</p> if notice and notice not in shown_errors else None}{<p className="success">Match setup saved.</p> if saved else None}</div> if shown_errors or shown_warnings or notice or saved else None}
        <div className="setup-layout">
            <div className="setup-settings">
                <section className="setup-card"><h2>Match details</h2>
                    <div className="setup-fields"><label>Opponent<input className="input" required value={opponent} onChange={lambda (e: ChangeEvent) { opponent = e.target.value; saved = False; }} /></label>
                        <label>Team name<input className="input" value={team_name} onChange={lambda (e: ChangeEvent) { team_name = e.target.value; saved = False; }} /></label>
                        <label>Date<input className="input" type="date" value={date} onChange={lambda (e: ChangeEvent) { date = e.target.value; saved = False; }} /></label>
                        <label>Kickoff <span className="optional">optional</span><input className="input" type="time" value={kickoff} onChange={lambda (e: ChangeEvent) { kickoff = e.target.value; saved = False; }} /></label>
                        <label className="span-2">Title <span className="optional">optional</span><input className="input" placeholder="e.g. Spring Cup semi-final" value={title} onChange={lambda (e: ChangeEvent) { title = e.target.value; saved = False; }} /></label></div></section>
                <section className="setup-card"><h2>Format and timing</h2>
                    <div className="setup-fields"><div className="setup-field-group span-2"><span className="setup-label">Format</span><div className="format-row">{[<button type="button" key={item} className={"format active" if format == item else "format"} onClick={lambda { change_format(item); }}>{item}</button> for item in ["7v7", "9v9", "11v11"]]}</div></div>
                        <label className="span-2">Formation<select className="input" value={formation_id} onChange={lambda (e: ChangeEvent) { change_formation(e.target.value); }}>{[<option key={item.id} value={item.id}>{item.shape}</option> for item in formations_for_format(format)]}</select></label>
                        <label>Half length (min)<input className="input" type="number" min="1" value={half_length} onChange={lambda (e: ChangeEvent) { half_length = e.target.value; saved = False; }} /></label>
                        <label>Halves<select className="input" value={halves} onChange={lambda (e: ChangeEvent) { halves = e.target.value; saved = False; }}><option value="2">2 halves</option><option value="1">1 running clock</option></select></label></div></section>
                <section className="setup-card"><div className="setup-card-head"><h2>Players</h2><span className="setup-muted">{len(selected_players)} of {len(team_players)} available</span></div>
                    <ul className="setup-players" onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={drop_on_roster}>{[<li key={player.id} className={"setup-player" + ("" if player.id in roster_ids else " is-off") + (" is-out" if player.id in unavailable_ids else "")} draggable={player.id in roster_ids and player.id not in unavailable_ids} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", player.id); }}><label className="setup-player-main"><input type="checkbox" checked={player.id in roster_ids} onChange={lambda (e: ChangeEvent) { toggle_roster(player.id, e.target.checked); }} /><span className="setup-jersey">{jersey_label(player.jersey_number)}</span><span className="setup-player-name">{player.name}</span></label>
                        {<label className="setup-out"><input type="checkbox" checked={player.id in unavailable_ids} onChange={lambda (e: ChangeEvent) { toggle_unavailable(player.id, e.target.checked); }} /> Out</label> if player.id in roster_ids else None}</li> for player in team_players]}</ul></section>
                <details className="setup-card setup-alerts"><summary><h2>Playing-time alerts</h2><span className="setup-muted">Min {minimum_playing_time} min · {len([group for (group, label) in alert_labels if thresholds[group].enabled])} of 4 positions on</span></summary>
                    <div className="setup-fields"><label>Minimum playing time (min)<input className="input" type="number" min="1" value={minimum_playing_time} onChange={lambda (e: ChangeEvent) { minimum_playing_time = e.target.value; saved = False; }} /></label>
                        <label>Assistant countdown (sec)<input className="input" type="number" min="1" value={assistant_accept_seconds} onChange={lambda (e: ChangeEvent) { assistant_accept_seconds = e.target.value; saved = False; }} /></label></div>
                    <div className="threshold-list">{[<div className="threshold" key={group}><label className="check-row"><input type="checkbox" checked={thresholds[group].enabled} onChange={lambda (e: ChangeEvent) { set_threshold(group, e.target.checked, thresholds[group].minutes); }} /> {label}</label>
                        <input type="range" min="1" max="30" value={thresholds[group].minutes} disabled={not thresholds[group].enabled} onChange={lambda (e: ChangeEvent) { set_threshold(group, thresholds[group].enabled, int(e.target.value)); }} /><span className="threshold-value">{thresholds[group].minutes} min</span></div> for (group, label) in alert_labels]}</div>
                    <label className="check-row"><input type="checkbox" checked={goalkeeper_rotation} onChange={lambda (e: ChangeEvent) { goalkeeper_rotation = e.target.checked; saved = False; }} /> Goalkeeper rotation alerts</label>
                    <label className="check-row"><input type="checkbox" checked={alert_sound} onChange={lambda (e: ChangeEvent) { alert_sound = e.target.checked; saved = False; }} /> Alert sound</label></details>
            </div>
            <section className="setup-card setup-lineup"><div className="setup-card-head"><h2>Starting lineup</h2>{<span className="setup-lineup-count">{len(assignments)} / {len(formation.positions)} placed</span> if formation else None}</div>
                <div className="lineup-actions"><select className="input" value="" onChange={lambda (e: ChangeEvent) { apply_lineup(e.target.value); }}><option value="">{"Load a saved lineup…" if team_lineups else "No saved lineups yet"}</option>{[<option key={lineup.id} value={lineup.id}>{lineup.name}</option> for lineup in team_lineups]}</select>
                    <button className="button secondary" type="button" onClick={auto_fill}>Auto-fill</button><Link className="button ghost" to="/lineups">Manage</Link></div>
                {<div className="setup-field"><div className="position-legend" aria-label="Position colors"><span><i className="legend-GK"></i> GK</span><span><i className="legend-DEF"></i> DEF</span><span><i className="legend-MID"></i> MID</span><span><i className="legend-FWD"></i> FWD</span><span className="setup-hint">Drag players in, or click a spot</span></div><div className="setup-pitch"><svg className="setup-pitch-lines" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden={True}><rect x="3" y="3" width="94" height="144" /><line x1="3" y1="75" x2="97" y2="75" /><circle cx="50" cy="75" r="9" /><circle cx="50" cy="75" r="0.8" fill="white" /><rect x="30" y="128" width="40" height="19" /><rect x="40" y="141" width="20" height="6" /><path d="M 38 128 A 12 12 0 0 1 62 128" /><rect x="30" y="3" width="40" height="19" /><rect x="40" y="3" width="20" height="6" /><path d="M 38 22 A 12 12 0 0 0 62 22" /></svg>{[<div className={"setup-slot group-" + position.group + (" occupied" if position.id in assignments else "") + (" goalkeeper" if position.group == "GK" else "")} key={position.id} draggable={position.id in assignments} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", assignments[position.id]); }} onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={lambda (e: any) { drop_on_slot(position.id, e); }} style={{"left": str(position.x) + "%", "top": str(position.y) + "%"}}>{[LineupToken(player) for player in selected_players if position.id in assignments and player.id == assignments[position.id]]}{EmptyPosition(position.label) if position.id not in assignments else None}<select aria-label={position.label} value={assignments[position.id] if position.id in assignments else ""} onChange={lambda (e: ChangeEvent) { assign(position.id, e.target.value); }}><option value="">Open</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in selected_players]}</select></div> for position in formation.positions]}</div></div> if formation else None}</section>
        </div>
    </section>
}
