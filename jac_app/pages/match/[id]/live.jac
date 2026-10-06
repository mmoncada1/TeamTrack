import "./live.css";
import from "@jac/runtime" { Link, useNavigate, useParams }
import from ....domain.formations { formation_by_id, formations_for_format }
import from ....domain.lineups { clear_slot, move_assignment, move_breaks_coed_rule }
import from ....domain.roster { clamp_min_girls }
import from ....domain.live_match { derive_match_state, pause_match, resume_match, go_to_half_time, end_match as end_match_action, move_player, swap_players, substitute_player, add_player_to_match, mark_player_injured, return_player_to_bench, remove_player_from_match, record_goal as record_goal_action, update_goal, record_card as record_card_action, record_note, update_note, delete_event, can_undo, undo_last_action, change_formation, reset_match as reset_match_action, with_alerts, with_settings }
import from ....domain.models { MatchSettings, ThresholdSetting }
import from ....domain.alerts { update_alerts, dismiss_alert }
import from ....state.AppState { use_app_state }

def clock_label(ms: int) -> str {
    total = int(ms / 1000); minutes = int(total / 60); seconds = total % 60;
    return str(minutes) + ":" + ("0" if seconds < 10 else "") + str(seconds);
}

def jersey_label(number: int | None) -> str { return "—" if number is None else "#" + str(number); }

def play_alert_tone() {
    try {
        browser: any = window;
        audio_class: any = browser.AudioContext or browser.webkitAudioContext;
        if not audio_class { return; }
        context: any = new(audio_class); oscillator: any = context.createOscillator(); gain: any = context.createGain();
        oscillator.type = "sine"; oscillator.frequency.value = 880; gain.gain.value = 0.06;
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = lambda { context.close(); };
        oscillator.start(); oscillator.stop(context.currentTime + 0.16);
    } except Exception { return; }
}


def player_name(players: list[any], id: str) -> str {
    for player in players { if player.id == id { return player.name; } }
    return "Unknown player";
}

def event_label(event: any, players: list[any]) -> str {
    if event.type == "MATCH_STARTED" { return "Match started"; }
    if event.type == "MATCH_PAUSED" { return "Clock paused"; }
    if event.type == "MATCH_RESUMED" { return "Clock resumed"; }
    if event.type == "HALF_TIME" { return "Half time"; }
    if event.type == "SECOND_HALF_STARTED" { return "Second half started"; }
    if event.type == "MATCH_ENDED" { return "Match ended"; }
    if event.type == "GOAL" { return ("Goal — " + player_name(players, event.data["scorer_id"])) if "scorer_id" in event.data and event.data["scorer_id"] else "Goal — " + ("TeamTrack" if event.data["team"] == "us" else "Opponent"); }
    if event.type == "CARD" { return event.data["color"].capitalize() + " card — " + player_name(players, event.data["player_id"]); }
    if event.type == "SUBSTITUTION" { return "Substitution — " + player_name(players, event.data["player_in_id"]) + " for " + player_name(players, event.data["player_out_id"]); }
    if event.type == "PLAYER_MOVED" { return "Moved " + player_name(players, event.data["player_id"]); }
    if event.type == "NOTE" { return event.note or "Match note"; }
    return event.type.replace("_", " ").capitalize();
}
def can_delete_live_event(event_type: str) -> bool { return event_type in ["GOAL", "CARD", "NOTE", "PLAYER_MOVED", "PLAYERS_SWAPPED", "SUBSTITUTION", "FORMATION_CHANGED"]; }


def:pub LiveMatchPage() -> JsxPage {
    state = use_app_state(); params = useParams(); navigate = useNavigate(); id = str(params["id"]); game = None;
    for item in state["matches"] { if item.id == id { game = item; break; } }
    has now: int = int(Date.now()); has goal_team: str = "us"; has own_goal: bool = False; has scorer_id: str = ""; has assister_id: str = "";
    has card_player_id: str = ""; has card_color: str = "yellow"; has note: str = ""; has action_error: str = ""; has editing_goal_id: str = "";
    has manage_player_id: str = ""; has late_player_id: str = "";
    has field_locked: bool = False;
    can with entry {
        raw = localStorage.getItem("teamtrack:app-settings");
        if raw { try { field_locked = bool(JSON.parse(raw)["fieldLocked"]); } except Exception { field_locked = False; } }
    }
    can with entry {
        ticker = window.setInterval(lambda { now = int(Date.now()); }, 500);
        return lambda { window.clearInterval(ticker); };
    }
    if not game { return <section className="page narrow-page"><h1>Match not found</h1><Link to="/matches">Back to matches</Link></section>; }
    derived = derive_match_state(game, now); status = derived.status; clock_ms = derived.display_clock_ms; formation = formation_by_id(derived.formation_id);
    assignments = derived.assignments; available_players = [player for player in state["players"] if player.id in derived.included_player_ids and derived.player_states[player.id].status != "unavailable"];
    match_players = [player for player in state["players"] if player.id in derived.included_player_ids];
    late_players = [player for player in state["players"] if player.team_id == game.team_id and player.id not in derived.included_player_ids and player.availability == "active"];
    assigned_ids = list(assignments.values()); bench_players = [player for player in available_players if player.id not in assigned_ids and derived.player_states[player.id].status == "bench"];
    team_score = derived.team_score; opponent_score = derived.opponent_score; current_half = derived.current_half;
    can with [now, game] entry {
        if status == "in_progress" and formation is not None {
            team = None;
            for item in state["teams"] { if item.id == game.team_id { team = item; break; } }
            result = update_alerts(game.active_alerts, derived.player_states,
                [player for player in state["players"] if player.id in derived.included_player_ids],
                game.settings.thresholds, game.settings.goalkeeper_rotation_enabled,
                formation.positions, game.roster_player_ids, derived.match_clock_ms,
                team.min_girls_on_field if team is not None and team.coed else None);
            if result.new_alert_ids and game.settings.alert_sound_enabled { play_alert_tone(); }
            if JSON.stringify(result.alerts) != JSON.stringify(game.active_alerts) {
                state["replaceMatch"].call(None, with_alerts(game, result.alerts, now));
            }
        }
    }

    def apply(next_game: any) -> bool {
        result = state["replaceMatch"].call(None, next_game); action_error = result; return not bool(result);
    }
    def pause_or_resume {
        if status == "in_progress" { apply(pause_match(game, now)); }
        else { apply(resume_match(game, now)); }
    }
    def set_slot(slot_id: str, next_player_id: str) {
        if field_locked { action_error = "Unlock the field before moving players."; return; }
        next_assignments = clear_slot(assignments, slot_id) if not next_player_id else move_assignment(assignments, next_player_id, slot_id);
        for team in state["teams"] {
            if team.id == game.team_id and team.coed and move_breaks_coed_rule(available_players, assignments, next_assignments, clamp_min_girls(team.min_girls_on_field)) {
                action_error = "Too many guys on the field. Keep the required girls in the lineup."; return;
            }
        }
        old_player_id = assignments[slot_id] if slot_id in assignments else ""; previous_slot = "";
        for (slot, assigned_id) in assignments.items() { if assigned_id == next_player_id { previous_slot = slot; } }
        if old_player_id == next_player_id { return; }
        if previous_slot and old_player_id { apply(swap_players(game, previous_slot, slot_id, now)); }
        elif old_player_id and next_player_id { apply(substitute_player(game, next_player_id, slot_id, now)); }
        elif next_player_id { apply(move_player(game, next_player_id, slot_id, now)); }
        elif old_player_id { apply(move_player(game, old_player_id, "BENCH", now)); }
    }
    def drop_on_slot(slot_id: str, event: any) {
        event.preventDefault();
        if field_locked or status == "ended" { return; }
        player_id = event.dataTransfer.getData("text/plain");
        if any([player.id == player_id for player in available_players]) { set_slot(slot_id, player_id); }
    }
    def drop_on_bench(event: any) {
        event.preventDefault();
        if field_locked or status == "ended" { return; }
        player_id = event.dataTransfer.getData("text/plain");
        for (slot, assigned_id) in assignments.items() { if assigned_id == player_id { set_slot(slot, ""); return; } }
    }
    def record_goal {
        scorer = scorer_id if scorer_id else None; assister = assister_id if assister_id else None;
        next_game = update_goal(game, editing_goal_id, goal_team, own_goal if goal_team == "us" else False, scorer, assister, None, now) if editing_goal_id else record_goal_action(game, goal_team, own_goal if goal_team == "us" else False, scorer, assister, None, now);
        if apply(next_game) { scorer_id = ""; assister_id = ""; editing_goal_id = ""; own_goal = False; }
    }
    def record_card {
        if not card_player_id { action_error = "Choose a player for the card."; return; }
        if apply(record_card_action(game, card_player_id, card_color, now)) { card_player_id = ""; }
    }
    def add_note {
        if not note.strip() { return; }
        if apply(record_note(game, note.strip(), now)) { note = ""; }
    }
    def end_match {
        if window.confirm("End this match? The clock will stop and the summary will open.") {
            if apply(end_match_action(game, now)) { navigate("/match/" + id + "/summary"); }
        }
    }
    def edit_goal(event: any) {
        editing_goal_id = event.id; goal_team = event.data["team"]; own_goal = bool(event.data.get("is_own_goal")); scorer_id = event.data.get("scorer_id") or ""; assister_id = event.data.get("assister_id") or "";
    }
    def edit_note(event: any) {
        revised = window.prompt("Edit match note", event.note or "");
        if revised is not None and revised.strip() { apply(update_note(game, event.id, revised.strip(), now)); }
    }
    def remove_event(event: any) {
        if window.confirm("Delete this " + event.type.replace("_", " ").lower() + " event?") { apply(delete_event(game, event.id, now)); }
    }
    def undo_action { if can_undo(game) { apply(undo_last_action(game, now)); } }
    def change_live_formation(next_id: str) { if not field_locked and next_id != derived.formation_id { apply(change_formation(game, next_id, now).game); } }
    def half_time { apply(go_to_half_time(game, now)); }
    def reset_live {
        if window.confirm("Reset the match and return to setup?") { apply(reset_match_action(game, now)); navigate("/match/" + id + "/setup"); }
    }
    def handle_alert(alert_id: str, action: str) {
        try { apply(with_alerts(game, dismiss_alert(game.active_alerts, alert_id, action, derived.match_clock_ms), now)); }
        except Exception { action_error = "Could not update that alert."; }
    }
    def toggle_field_lock(locked: bool) {
        field_locked = locked;
        raw = localStorage.getItem("teamtrack:app-settings"); settings: dict[str, any] = {};
        if raw { try { settings = JSON.parse(raw) as dict[str, any]; } except Exception { settings = {}; } }
        settings["fieldLocked"] = locked; localStorage.setItem("teamtrack:app-settings", JSON.stringify(settings));
    }
    def save_live_settings(group: str, enabled: bool | None, minutes: int | None, goalkeeper: bool | None) {
        next_thresholds = dict(game.settings.thresholds);
        if group in next_thresholds {
            current = next_thresholds[group];
            next_thresholds[group] = ThresholdSetting(enabled=enabled if enabled is not None else current.enabled,
                minutes=minutes if minutes is not None else current.minutes);
        }
        next_settings = MatchSettings(format=game.settings.format, formation_id=game.settings.formation_id,
            half_length_minutes=game.settings.half_length_minutes, number_of_halves=game.settings.number_of_halves,
            thresholds=next_thresholds, goalkeeper_rotation_enabled=goalkeeper if goalkeeper is not None else game.settings.goalkeeper_rotation_enabled,
            alert_sound_enabled=game.settings.alert_sound_enabled);
        apply(with_settings(game, next_settings, now));
    }
    def accept_alert(alert: any) {
        if alert.recommendation is None { return; }
        player_state = derived.player_states[alert.player_id];
        if player_state.position_id is None { return; }
        set_slot(player_state.position_id, alert.recommendation["in_player_id"]);
    }
    def manage_player(action: str) {
        if not manage_player_id { action_error = "Choose a player."; return; }
        try {
            if action == "injure" { apply(mark_player_injured(game, manage_player_id, now)); }
            elif action == "return" { apply(return_player_to_bench(game, manage_player_id, now)); }
            elif action == "remove" and window.confirm("Remove this player from the match?") { apply(remove_player_from_match(game, manage_player_id, now)); }
            manage_player_id = "";
        } except Exception { action_error = "Could not change that player's match status."; }
    }
    def add_late_player {
        if not late_player_id { action_error = "Choose a player to add."; return; }
        try { if apply(add_player_to_match(game, late_player_id, now)) { late_player_id = ""; } }
        except Exception { action_error = "Could not add that player to the match."; }
    }

    <section className="page live-match"><header className="live-header"><div><p className="eyebrow">{game.title or "Live match"}</p><h1>{game.team_name} vs {game.opponent_name}</h1></div><Link className="button ghost" to="/matches">Matches</Link></header>
        {<p className="error" role="alert">{action_error}</p> if action_error else None}
        <div className="score-clock"><div className="score"><span>{game.team_name}</span><strong>{team_score} – {opponent_score}</strong><span>{game.opponent_name}</span></div><div className="clock"><strong>{clock_label(clock_ms)}</strong><span>Half {current_half} · {status.replace("_", " ")}</span></div>
            <div className="clock-actions">{<button className="button primary" type="button" onClick={pause_or_resume}>{"Pause" if status == "in_progress" else ("Start second half" if status == "half_time" else "Resume")}</button> if status != "ended" else None}{<button className="button secondary" type="button" onClick={half_time}>Half time</button> if status == "in_progress" and game.settings.number_of_halves > 1 and current_half == 1 else None}<button className="button danger" type="button" disabled={status == "ended"} onClick={end_match}>End match</button></div></div>
        <div className="live-grid"><div className="field-column"><section className="live-card"><div className="section-heading"><h2>Field</h2><span>{game.settings.format} · {formation.shape if formation else game.pending_formation_id}</span></div>
            {<div className="live-pitch">{[<label className="live-slot" key={position.id} draggable={not field_locked and status != "ended" and position.id in assignments} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", assignments[position.id]); }} onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={lambda (e: any) { drop_on_slot(position.id, e); }} style={{"left": str(position.x) + "%", "top": str(position.y) + "%"}}><span>{position.label}</span><select disabled={field_locked or status == "ended"} value={assignments[position.id] if position.id in assignments else ""} onChange={lambda (e: ChangeEvent) { set_slot(position.id, e.target.value); }}><option value="">Open</option>{[<option key={player.id} value={player.id}>{jersey_label(player.jersey_number)} {player.name}</option> for player in available_players]}</select></label> for position in formation.positions]}</div> if formation else <p className="error">Formation unavailable.</p>}</section>
            <section className="live-card" onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={drop_on_bench}><h2>Bench</h2>{<div className="bench-list">{[<span className="bench-chip" key={player.id} draggable={not field_locked and status != "ended"} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", player.id); }}>{jersey_label(player.jersey_number)} {player.name}</span> for player in bench_players]}</div> if bench_players else <p className="muted">No available players on the bench.</p>}</section></div>
            <aside className="live-sidebar"><section className="live-card"><h2>Playing-time alerts</h2>{[<div className="alert-item" key={alert.id}><strong>{player_name(available_players, alert.player_id)} · {alert.position_group}</strong><p>{str(alert.threshold_minutes)} minute threshold reached.</p>{<p>{player_name(available_players, alert.recommendation["in_player_id"])} recommended: {alert.recommendation["explanation"]}</p> if alert.recommendation is not None else None}<div className="inline-control">{<button className="button primary small" type="button" onClick={lambda { accept_alert(alert); }}>Substitute</button> if alert.recommendation is not None else None}<button className="button secondary small" type="button" onClick={lambda { handle_alert(alert.id, "snooze"); }}>Snooze 3 min</button><button className="button ghost small" type="button" onClick={lambda { handle_alert(alert.id, "dismiss"); }}>Dismiss</button></div></div> for alert in game.active_alerts if alert.status == "active"]}{<p className="muted">No active alerts.</p> if not any([alert.status == "active" for alert in game.active_alerts]) else None}</section><section className="live-card"><h2>Formation</h2><select className="input" value={derived.formation_id} disabled={status == "ended" or field_locked} onChange={lambda (e: ChangeEvent) { change_live_formation(e.target.value); }}>{[<option key={item.id} value={item.id}>{item.shape}</option> for item in formations_for_format(game.settings.format)]}</select></section><section className="live-card"><h2>{"Edit goal" if editing_goal_id else "Record goal"}</h2><div className="form-stack"><label>For<select className="input" value={goal_team} onChange={lambda (e: ChangeEvent) { goal_team = e.target.value; }}><option value="us">{game.team_name}</option><option value="opponent">{game.opponent_name}</option></select></label>{<label className="inline-control"><input type="checkbox" checked={own_goal} onChange={lambda (e: ChangeEvent) { own_goal = e.target.checked; }} /> Own goal by our team</label> if goal_team == "us" else None}{<><label>Scorer (optional)<select className="input" value={scorer_id} onChange={lambda (e: ChangeEvent) { scorer_id = e.target.value; }}><option value="">Uncredited</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in available_players]}</select></label><label>Assist (optional)<select className="input" value={assister_id} onChange={lambda (e: ChangeEvent) { assister_id = e.target.value; }}><option value="">None</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in available_players]}</select></label></> if goal_team == "us" else None}<div className="inline-control"><button className="button primary" type="button" disabled={status == "ended"} onClick={record_goal}>{"Save goal" if editing_goal_id else "Add goal"}</button>{<button className="button ghost" type="button" onClick={lambda { editing_goal_id = ""; scorer_id = ""; assister_id = ""; own_goal = False; }}>Cancel</button> if editing_goal_id else None}</div></div></section>
                <section className="live-card"><h2>Card</h2><div className="inline-control"><select className="input" value={card_player_id} onChange={lambda (e: ChangeEvent) { card_player_id = e.target.value; }}><option value="">Choose player</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in available_players]}</select><select className="input color-select" value={card_color} onChange={lambda (e: ChangeEvent) { card_color = e.target.value; }}><option value="yellow">Yellow</option><option value="red">Red</option></select><button className="button secondary" type="button" disabled={status == "ended"} onClick={record_card}>Record</button></div></section>
                <section className="live-card"><h2>Note</h2><div className="inline-control"><input className="input" value={note} placeholder="Add a match note" onChange={lambda (e: ChangeEvent) { note = e.target.value; }} /><button className="button secondary" type="button" disabled={status == "ended"} onClick={add_note}>Add</button></div></section></aside></div>
        <section className="live-card"><label className="inline-control"><input type="checkbox" checked={field_locked} onChange={lambda (e: ChangeEvent) { toggle_field_lock(e.target.checked); }} /> Lock field layout</label><details><summary>Substitution timers</summary><p className="muted">Changes affect the next alert. The current field stint continues.</p>{[<div className="inline-control" key={group}><strong>{group}</strong><label><input type="checkbox" checked={game.settings.thresholds[group].enabled} onChange={lambda (e: ChangeEvent) { save_live_settings(group, e.target.checked, None, None); }} /> Enabled</label><label>Minutes <input className="input" type="number" min="1" max="60" value={game.settings.thresholds[group].minutes} onChange={lambda (e: ChangeEvent) { save_live_settings(group, None, max(1, min(60, int(e.target.value or "1"))), None); }} /></label></div> for group in ["GK", "DEF", "MID", "FWD"] if group in game.settings.thresholds]}<label className="inline-control"><input type="checkbox" checked={game.settings.goalkeeper_rotation_enabled} onChange={lambda (e: ChangeEvent) { save_live_settings("", None, None, e.target.checked); }} /> Enable goalkeeper rotation alerts</label></details></section>
        <section className="live-card"><h2>Playing time and roster</h2><div className="table-scroll"><table><thead><tr><th>Player</th><th>Status</th><th>Field</th><th>Bench</th></tr></thead><tbody>{[<tr key={player.id}><td>{player.name}</td><td>{derived.player_states[player.id].status}</td><td>{clock_label(derived.player_states[player.id].total_field_ms)}</td><td>{clock_label(derived.player_states[player.id].total_bench_ms)}</td></tr> for player in match_players]}</tbody></table></div><div className="inline-control"><select className="input" value={manage_player_id} onChange={lambda (e: ChangeEvent) { manage_player_id = e.target.value; }}><option value="">Choose match player</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in match_players]}</select><button className="button secondary small" type="button" disabled={status == "ended" or not manage_player_id} onClick={lambda { manage_player("injure"); }}>Mark injured</button><button className="button secondary small" type="button" disabled={status == "ended" or not manage_player_id} onClick={lambda { manage_player("return"); }}>Return to bench</button><button className="button ghost small" type="button" disabled={status == "ended" or not manage_player_id} onClick={lambda { manage_player("remove"); }}>Remove</button></div>{<div className="inline-control"><select className="input" value={late_player_id} onChange={lambda (e: ChangeEvent) { late_player_id = e.target.value; }}><option value="">Add a late player</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in late_players]}</select><button className="button secondary small" type="button" disabled={status == "ended" or not late_player_id} onClick={add_late_player}>Add to match</button></div> if late_players else None}</section>
        <section className="live-card event-log"><div className="section-heading"><h2>Event log</h2><div className="event-toolbar"><button className="button secondary small" type="button" disabled={not can_undo(game)} onClick={undo_action}>Undo last action</button><button className="button ghost small" type="button" onClick={reset_live}>Reset match</button></div></div>{<ol>{[<li key={event.id}><time>{clock_label(event.match_clock_ms)}</time><span>{event_label(event, available_players)}</span><span className="event-actions">{<button className="button ghost small" type="button" onClick={lambda { edit_goal(event); }}>Edit</button> if event.type == "GOAL" else None}{<button className="button ghost small" type="button" onClick={lambda { edit_note(event); }}>Edit</button> if event.type == "NOTE" else None}{<button className="button ghost small" type="button" onClick={lambda { remove_event(event); }}>Delete</button> if can_delete_live_event(event.type) else None}</span></li> for event in game.events]}</ol> if game.events else <p className="muted">No events yet.</p>}</section>
    </section>
}
