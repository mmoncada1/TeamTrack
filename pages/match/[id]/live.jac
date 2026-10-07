import "../../lineups.css";
import from ....components.LineupToken { LineupToken }
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

def jersey_label(number: int | None) -> str { return "" if number is None else "#" + str(number); }

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

def player_group(players: list[any], id: str) -> str {
    for player in players { if player.id == id { return player.preferred_group; } }
    return "";
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


def LivePlayerToken(player: any, player_state: any, surface: str) -> JsxElement {
    return <div className={"live-player-token " + surface}>{LineupToken(player)}<span className="live-player-timer">{clock_label(player_state.current_stint_ms)}</span></div>;
}

def:pub LiveMatchPage() -> JsxPage {
    state = use_app_state(); params = useParams(); navigate = useNavigate(); id = str(params["id"]); game = None;
    for item in state["matches"] { if item.id == id { game = item; break; } }
    has now: int = int(Date.now()); has goal_team: str = "us"; has own_goal: bool = False; has scorer_id: str = ""; has assister_id: str = "";
    has card_player_id: str = ""; has card_color: str = "yellow"; has note: str = ""; has action_error: str = ""; has editing_goal_id: str = ""; has goal_dialog_open: bool = False; has goal_error: str = "";
    has manage_player_id: str = ""; has late_player_id: str = "";
    has active_token_id: str = ""; has dialog_player_id: str = ""; has dialog_kind: str = "";
    has move_destination: str = ""; has detail_name: str = ""; has detail_group: str = ""; has dialog_error: str = "";
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
    dialog_player = None; current_player_slot = "BENCH";
    for player in match_players { if player.id == dialog_player_id { dialog_player = player; break; } }
    for (slot, assigned_id) in assignments.items() { if assigned_id == dialog_player_id { current_player_slot = slot; break; } }
    active_team = None;
    for item in state["teams"] { if item.id == game.team_id { active_team = item; break; } }
    min_girls = clamp_min_girls(active_team.min_girls_on_field) if active_team is not None and active_team.coed else None;
    girls_on_field = len([player for player in available_players if player.id in assigned_ids and player.gender == "girl"]);
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
    def open_goal_dialog {
        editing_goal_id = ""; goal_team = "us"; own_goal = False; scorer_id = ""; assister_id = ""; goal_error = ""; goal_dialog_open = True;
    }
    def close_goal_dialog { goal_dialog_open = False; goal_error = ""; editing_goal_id = ""; }
    def record_goal {
        if goal_team == "us" and not own_goal and not scorer_id { goal_error = "Select the scorer."; return; }
        if scorer_id and assister_id and scorer_id == assister_id and not own_goal { goal_error = "The scorer and assister cannot be the same player."; return; }
        scorer = scorer_id if scorer_id and goal_team == "us" else None;
        assister = assister_id if assister_id and goal_team == "us" and not own_goal else None;
        try {
            next_game = update_goal(game, editing_goal_id, goal_team, own_goal, scorer, assister, None, now) if editing_goal_id else record_goal_action(game, goal_team, own_goal, scorer, assister, None, now);
            if apply(next_game) { close_goal_dialog(); scorer_id = ""; assister_id = ""; own_goal = False; }
            else { goal_error = action_error; }
        } except Exception { goal_error = "Could not save this goal. Check the selected players."; }
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
        editing_goal_id = event.id; goal_team = event.data["team"]; own_goal = bool(event.data.get("is_own_goal")); scorer_id = event.data.get("scorer_id") or ""; assister_id = event.data.get("assister_id") or ""; goal_error = ""; goal_dialog_open = True;
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

    def open_player_dialog(player: any, kind: str) {
        dialog_player_id = player.id; dialog_kind = kind; dialog_error = ""; move_destination = "";
        detail_name = player.name; detail_group = player.preferred_group; active_token_id = player.id;
    }
    def close_player_dialog { dialog_kind = ""; dialog_player_id = ""; dialog_error = ""; }
    def move_dialog_player {
        if not dialog_player_id or not move_destination or move_destination == current_player_slot { return; }
        action_error = "";
        if move_destination == "BENCH" { set_slot(current_player_slot, ""); }
        else { set_slot(move_destination, dialog_player_id); }
        if not action_error { close_player_dialog(); }
        else { dialog_error = action_error; }
    }
    def player_dialog_action(action: str) {
        if dialog_player is None { return; }
        try {
            if action == "injure" { apply(mark_player_injured(game, dialog_player_id, now)); }
            elif action == "return" { apply(return_player_to_bench(game, dialog_player_id, now)); }
            elif action == "yellow" or action == "red" { apply(record_card_action(game, dialog_player_id, action, now)); }
            elif action == "remove" {
                if not window.confirm("Remove " + dialog_player.name + " from this match?") { return; }
                apply(remove_player_from_match(game, dialog_player_id, now));
            }
            if action_error { dialog_error = action_error; }
            else { close_player_dialog(); }
        } except Exception { dialog_error = "Could not update this player."; }
    }
    def save_player_details {
        if dialog_player is None { return; }
        groups = [detail_group] + [group for group in dialog_player.preferred_groups if group != detail_group];
        errors = state["savePlayer"].call(None, dialog_player.id, detail_name, dialog_player.jersey_number,
            groups, dialog_player.gender, dialog_player.notes or "", dialog_player.availability, None);
        if errors { dialog_error = ", ".join(errors); }
        else { close_player_dialog(); }
    }

    <section className="page live-match" onClick={lambda { active_token_id = ""; }}>
        {<p className="error" role="alert">{action_error}</p> if action_error else None}
        <div className="live-grid">
            <div className="live-alert-column"><h1>{game.team_name} vs {game.opponent_name}</h1>
                {<div className={"coed-status " + ("short" if girls_on_field < min_girls else "")}>Girls on field {girls_on_field}/{min_girls}</div> if min_girls is not None else None}
                <section className="live-alert-list" aria-label="Substitution alerts">{[<div className="alert-item" key={alert.id}><div className="alert-heading"><strong>{player_name(available_players, alert.player_id)} ({alert.position_group})</strong><button className="alert-dismiss" type="button" onClick={lambda { handle_alert(alert.id, "dismiss"); }}>Dismiss</button></div>{<button className="alert-sub-button" type="button" onClick={lambda { accept_alert(alert); }}>Sub in {player_name(available_players, alert.recommendation["in_player_id"])} ({player_group(available_players, alert.recommendation["in_player_id"])})</button> if alert.recommendation is not None else <button className="alert-sub-button" type="button" onClick={lambda { handle_alert(alert.id, "snooze"); }}>Snooze 3 min</button>}</div> for alert in game.active_alerts if alert.status == "active"]}{<p className="muted">No alerts</p> if not any([alert.status == "active" for alert in game.active_alerts]) else None}</section>
            </div>
            <div className="live-workspace"><div className="live-bench"><section className="live-card" onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={drop_on_bench}><h2>Bench ({len(bench_players)})</h2>{<div className="bench-list">{[<div className={"live-bench-token " + ("selected" if active_token_id == player.id else "")} key={player.id} tabIndex={0} onClick={lambda (e: MouseEvent) { e.stopPropagation(); active_token_id = player.id; }} onDoubleClick={lambda (e: MouseEvent) { e.stopPropagation(); open_player_dialog(player, "edit"); }} draggable={not field_locked and status != "ended"} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", player.id); }}>{LivePlayerToken(player, derived.player_states[player.id], "bench")}<div className="live-token-actions"><button type="button" onClick={lambda (e: MouseEvent) { e.stopPropagation(); open_player_dialog(player, "edit"); }}>Edit</button><button type="button" disabled={field_locked or status == "ended"} onClick={lambda (e: MouseEvent) { e.stopPropagation(); open_player_dialog(player, "move"); }}>Move…</button></div></div> for player in bench_players]}</div> if bench_players else <p className="muted">No available players on the bench.</p>}</section></div><div className="live-field"><div className="position-legend" aria-label="Player colors by roster position"><span className="legend-add">Add</span><span><i className="legend-GK"></i> GK Goalkeeper</span><span><i className="legend-DEF"></i> DEF Defender</span><span><i className="legend-MID"></i> MID Midfielder</span><span><i className="legend-FWD"></i> FWD Forward</span></div>{<div className="live-pitch"><svg viewBox="0 0 100 150" preserveAspectRatio="none" className="live-pitch-lines" aria-hidden={True}><rect x="3" y="3" width="94" height="144" /><line x1="3" y1="75" x2="97" y2="75" /><circle cx="50" cy="75" r="9" /><circle cx="50" cy="75" r="0.8" fill="white" /><rect x="30" y="128" width="40" height="19" /><rect x="40" y="141" width="20" height="6" /><path d="M 38 128 A 12 12 0 0 1 62 128" /><rect x="30" y="3" width="40" height="19" /><rect x="40" y="3" width="20" height="6" /><path d="M 38 22 A 12 12 0 0 0 62 22" /></svg>{[<div className={"live-slot " + ("selected" if position.id in assignments and active_token_id == assignments[position.id] else "")} key={position.id} tabIndex={0} onClick={lambda (e: MouseEvent) { e.stopPropagation(); if position.id in assignments { active_token_id = assignments[position.id]; } }} onDoubleClick={lambda (e: MouseEvent) { e.stopPropagation(); for player in available_players { if position.id in assignments and player.id == assignments[position.id] { open_player_dialog(player, "edit"); break; } } }} draggable={not field_locked and status != "ended" and position.id in assignments} onDragStart={lambda (e: any) { e.dataTransfer.setData("text/plain", assignments[position.id]); }} onDragOver={lambda (e: any) { e.preventDefault(); }} onDrop={lambda (e: any) { drop_on_slot(position.id, e); }} style={{"left": str(position.x) + "%", "top": str(position.y) + "%"}}>{[LivePlayerToken(player, derived.player_states[player.id], "field") for player in available_players if position.id in assignments and player.id == assignments[position.id]]}<span>{position.label if position.id not in assignments else ""}</span>{[<div className="live-token-actions" key={player.id}><button type="button" onClick={lambda (e: MouseEvent) { e.stopPropagation(); open_player_dialog(player, "edit"); }}>Edit</button><button type="button" disabled={field_locked or status == "ended"} onClick={lambda (e: MouseEvent) { e.stopPropagation(); open_player_dialog(player, "move"); }}>Move…</button></div> for player in available_players if position.id in assignments and player.id == assignments[position.id]]}<select aria-label={position.label} disabled={field_locked or status == "ended"} value={assignments[position.id] if position.id in assignments else ""} onChange={lambda (e: ChangeEvent) { set_slot(position.id, e.target.value); }}><option value="">Open</option>{[<option key={player.id} value={player.id}>{jersey_label(player.jersey_number)} {player.name}</option> for player in available_players]}</select></div> for position in formation.positions]}</div> if formation else <p className="error">Formation unavailable.</p>}</div></div>
            <aside className="live-sidebar">
                <div className="live-save">Saved</div>
                <section className="live-card live-clock"><div className="clock"><strong>{clock_label(clock_ms)}</strong><span>🟢 {"Live" if status == "in_progress" else status.replace("_", " ").capitalize()} · Half {current_half}</span></div><div className="clock-actions">{<button className="button secondary" type="button" onClick={pause_or_resume}>{"Pause" if status == "in_progress" else ("Start second half" if status == "half_time" else "Resume")}</button> if status != "ended" else None}{<button className="button secondary" type="button" onClick={half_time}>Half-time</button> if status == "in_progress" and game.settings.number_of_halves > 1 and current_half == 1 else None}<button className="button danger" type="button" disabled={status == "ended"} onClick={end_match}>End match</button></div></section>
                <section className="live-card live-score"><div className="score"><div><span>{game.team_name}</span><strong>{team_score}</strong></div><span>–</span><div><span>{game.opponent_name}</span><strong>{opponent_score}</strong></div></div><button className="button primary" type="button" disabled={status == "ended"} onClick={open_goal_dialog}>+ Goal</button></section>
                <section className="live-card"><h2>Formation</h2><select className="input" value={derived.formation_id} disabled={status == "ended" or field_locked} onChange={lambda (e: ChangeEvent) { change_live_formation(e.target.value); }}>{[<option key={item.id} value={item.id}>{item.shape}</option> for item in formations_for_format(game.settings.format)]}</select><label className="inline-control"><input type="checkbox" checked={field_locked} onChange={lambda (e: ChangeEvent) { toggle_field_lock(e.target.checked); }} /> Lock field layout</label></section><section className="live-card live-timers"><details><summary>Substitution timers</summary><p className="muted">Changes affect the next alert. The current field stint continues.</p>{[<div className="inline-control" key={group}><strong>{group}</strong><label><input type="checkbox" checked={game.settings.thresholds[group].enabled} onChange={lambda (e: ChangeEvent) { save_live_settings(group, e.target.checked, None, None); }} /> Enabled</label><label>Minutes <input className="input" type="number" min="1" max="60" value={game.settings.thresholds[group].minutes} onChange={lambda (e: ChangeEvent) { save_live_settings(group, None, max(1, min(60, int(e.target.value or "1"))), None); }} /></label></div> for group in ["GK", "DEF", "MID", "FWD"] if group in game.settings.thresholds]}<label className="inline-control"><input type="checkbox" checked={game.settings.goalkeeper_rotation_enabled} onChange={lambda (e: ChangeEvent) { save_live_settings("", None, None, e.target.checked); }} /> Enable goalkeeper rotation alerts</label></details></section><section className="live-card"><h2>Time tracker</h2><p className="muted">Current stint and total field and bench time for each player.</p><div className="table-scroll"><table><thead><tr><th>Player</th><th>Now</th><th>Field</th><th>Bench</th></tr></thead><tbody>{[<tr key={player.id}><td>{player.name}</td><td>{"Field " if derived.player_states[player.id].status == "field" else "Bench "}{clock_label(derived.player_states[player.id].current_stint_ms)}</td><td>{clock_label(derived.player_states[player.id].total_field_ms)}</td><td>{clock_label(derived.player_states[player.id].total_bench_ms)}</td></tr> for player in match_players]}</tbody></table></div><div className="inline-control"><select className="input" value={manage_player_id} onChange={lambda (e: ChangeEvent) { manage_player_id = e.target.value; }}><option value="">Choose match player</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in match_players]}</select><button className="button secondary small" type="button" disabled={status == "ended" or not manage_player_id} onClick={lambda { manage_player("injure"); }}>Mark injured</button><button className="button secondary small" type="button" disabled={status == "ended" or not manage_player_id} onClick={lambda { manage_player("return"); }}>Return to bench</button><button className="button ghost small" type="button" disabled={status == "ended" or not manage_player_id} onClick={lambda { manage_player("remove"); }}>Remove</button></div>{<div className="inline-control"><select className="input" value={late_player_id} onChange={lambda (e: ChangeEvent) { late_player_id = e.target.value; }}><option value="">Add a late player</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in late_players]}</select><button className="button secondary small" type="button" disabled={status == "ended" or not late_player_id} onClick={add_late_player}>Add to match</button></div> if late_players else None}</section><section className="live-card"><h2>Card</h2><div className="inline-control"><select className="input" value={card_player_id} onChange={lambda (e: ChangeEvent) { card_player_id = e.target.value; }}><option value="">Choose player</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in available_players]}</select><select className="input color-select" value={card_color} onChange={lambda (e: ChangeEvent) { card_color = e.target.value; }}><option value="yellow">Yellow</option><option value="red">Red</option></select><button className="button secondary" type="button" disabled={status == "ended"} onClick={record_card}>Record</button></div></section>
                <section className="live-card"><h2>Note</h2><div className="inline-control"><input className="input" value={note} placeholder="Add a match note" onChange={lambda (e: ChangeEvent) { note = e.target.value; }} /><button className="button secondary" type="button" disabled={status == "ended"} onClick={add_note}>Add</button></div></section><section className="live-card event-log"><div className="section-heading"><h2>Event log</h2><div className="event-toolbar"><button className="button secondary small" type="button" disabled={not can_undo(game)} onClick={undo_action}>Undo last action</button></div></div>{<ol>{[<li key={event.id}><time>{clock_label(event.match_clock_ms)}</time><span>{event_label(event, available_players)}</span><span className="event-actions">{<button className="button ghost small" type="button" onClick={lambda { edit_goal(event); }}>Edit</button> if event.type == "GOAL" else None}{<button className="button ghost small" type="button" onClick={lambda { edit_note(event); }}>Edit</button> if event.type == "NOTE" else None}{<button className="button ghost small" type="button" onClick={lambda { remove_event(event); }}>Delete</button> if can_delete_live_event(event.type) else None}</span></li> for event in game.events]}</ol> if game.events else <p className="muted">No events yet.</p>}</section>

            </aside>
        </div>
        <div className="live-footer"><button className="button ghost" type="button" onClick={reset_live}>Reset match…</button></div>
        {<div className="live-dialog-backdrop" onClick={close_goal_dialog}><section className="live-player-dialog live-goal-dialog" role="dialog" aria-modal={True} aria-label={"Edit goal" if editing_goal_id else "Record goal"} onClick={lambda (e: MouseEvent) { e.stopPropagation(); }}><h2>{"Edit goal" if editing_goal_id else "Record goal"}</h2><fieldset className="goal-kind"><legend>Goal type</legend><div><label><input type="radio" name="goal-kind" checked={goal_team == "us" and not own_goal} onChange={lambda { goal_team = "us"; own_goal = False; goal_error = ""; }} /> Our goal</label><label><input type="radio" name="goal-kind" checked={goal_team == "opponent"} onChange={lambda { goal_team = "opponent"; own_goal = False; goal_error = ""; }} /> Opponent goal</label><label><input type="radio" name="goal-kind" checked={own_goal} onChange={lambda { goal_team = "us"; own_goal = True; assister_id = ""; goal_error = ""; }} /> Own goal (against us)</label></div></fieldset>{<label className="goal-field">{"Player responsible (optional)" if own_goal else "Scorer"}<select className="input" value={scorer_id} onChange={lambda (e: ChangeEvent) { scorer_id = e.target.value; goal_error = ""; }}><option value="">{"— Not recorded —" if own_goal else "— Select scorer —"}</option>{[<option key={player.id} value={player.id}>{jersey_label(player.jersey_number)} {player.name}</option> for player in available_players]}</select></label> if goal_team == "us" else None}{<label className="goal-field">Assist (optional)<select className="input" value={assister_id} onChange={lambda (e: ChangeEvent) { assister_id = e.target.value; goal_error = ""; }}><option value="">— No assist —</option>{[<option key={player.id} value={player.id}>{jersey_label(player.jersey_number)} {player.name}</option> for player in available_players]}</select></label> if goal_team == "us" and not own_goal else None}{<p className="goal-error" role="alert">{goal_error}</p> if goal_error else None}<div className="live-dialog-footer"><button className="button ghost" type="button" onClick={close_goal_dialog}>Cancel</button><button className="button primary" type="button" onClick={record_goal}>{"Save changes" if editing_goal_id else "Save goal"}</button></div></section></div> if goal_dialog_open else None}
        {<div className="live-dialog-backdrop" onClick={close_player_dialog}><section className="live-player-dialog" role="dialog" aria-modal={True} aria-label={("Move " if dialog_kind == "move" else "Edit ") + dialog_player.name} onClick={lambda (e: MouseEvent) { e.stopPropagation(); }}>
            {<><h2>Move {dialog_player.name}</h2><p>Choose a destination, then confirm.</p><div className="live-move-options"><label className="live-move-option"><span><input type="radio" name="move-destination" checked={move_destination == "BENCH"} disabled={current_player_slot == "BENCH"} onChange={lambda { move_destination = "BENCH"; }} /> Bench {<small>(current)</small> if current_player_slot == "BENCH" else None}</span></label>{[<label className="live-move-option" key={position.id}><span><input type="radio" name="move-destination" checked={move_destination == position.id} disabled={current_player_slot == position.id} onChange={lambda { move_destination = position.id; }} /> {position.label} {<small>(current)</small> if current_player_slot == position.id else None}</span>{<small>Swap with {player_name(match_players, assignments[position.id])}</small> if position.id in assignments and assignments[position.id] != dialog_player_id else None}</label> for position in formation.positions]}</div><div className="live-dialog-footer"><button className="button ghost" type="button" onClick={close_player_dialog}>Cancel</button><button className="button primary" type="button" disabled={not move_destination or move_destination == current_player_slot} onClick={move_dialog_player}>Confirm move</button></div></> if dialog_kind == "move" and formation is not None else None}
            {<><h2>{dialog_player.name}</h2><p>Double-click a player any time during the match.</p><div className="live-edit-actions">{<button className="button secondary" type="button" onClick={lambda { player_dialog_action("return"); }}>Return to bench</button> if derived.player_states[dialog_player_id].status == "unavailable" else <button className="button secondary" type="button" disabled={status == "ended"} onClick={lambda { player_dialog_action("injure"); }}>Mark injured</button>}<button className="button secondary" type="button" disabled={status == "ended"} onClick={lambda { player_dialog_action("yellow"); }}>Yellow card</button><button className="button danger" type="button" disabled={status == "ended"} onClick={lambda { player_dialog_action("red"); }}>Red card</button><button className="button secondary" type="button" onClick={lambda { dialog_kind = "details"; }}>Edit name and position</button><button className="button danger" type="button" disabled={status == "ended"} onClick={lambda { player_dialog_action("remove"); }}>Remove from match</button></div></> if dialog_kind == "edit" else None}
            {<><h2>Edit {dialog_player.name}</h2><label className="live-detail-label">Name<input className="input" value={detail_name} onChange={lambda (e: ChangeEvent) { detail_name = e.target.value; }} /></label><label className="live-detail-label">Position<select className="input" value={detail_group} onChange={lambda (e: ChangeEvent) { detail_group = e.target.value; }}><option value="GK">Goalkeeper</option><option value="DEF">Defender</option><option value="MID">Midfielder</option><option value="FWD">Forward</option></select></label><div className="live-dialog-footer"><button className="button ghost" type="button" onClick={lambda { dialog_kind = "edit"; }}>Back</button><button className="button primary" type="button" onClick={save_player_details}>Save</button></div></> if dialog_kind == "details" else None}
            {<p className="error" role="alert">{dialog_error}</p> if dialog_error else None}
        </section></div> if dialog_kind and dialog_player is not None else None}
    </section>
}
