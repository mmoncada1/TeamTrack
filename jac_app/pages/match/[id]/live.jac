import "./live.css";
import from "@jac/runtime" { Link, useNavigate, useParams }
import from ....domain.formations { formation_by_id, formations_for_format }
import from ....domain.roster { jersey_label }
import from ....domain.live_match { derive_match_state, pause_match, resume_match, go_to_half_time, end_match as end_match_action, move_player, swap_players, substitute_player, record_goal as record_goal_action, update_goal, record_card as record_card_action, record_note, update_note, delete_event, can_undo, undo_last_action, change_formation, reset_match as reset_match_action }
import from ....state.AppState { use_app_state }

def clock_label(ms: int) -> str {
    total = int(ms / 1000); minutes = int(total / 60); seconds = total % 60;
    return str(minutes) + ":" + ("0" if seconds < 10 else "") + str(seconds);
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
    has now: int = int(Date.now()); has goal_team: str = "us"; has scorer_id: str = ""; has assister_id: str = "";
    has card_player_id: str = ""; has card_color: str = "yellow"; has note: str = ""; has action_error: str = ""; has editing_goal_id: str = "";
    can with entry {
        ticker = window.setInterval(lambda { now = int(Date.now()); }, 500);
        return lambda { window.clearInterval(ticker); };
    }
    if not game { return <section className="page narrow-page"><h1>Match not found</h1><Link to="/matches">Back to matches</Link></section>; }
    derived = derive_match_state(game, now); status = derived.status; clock_ms = derived.display_clock_ms; formation = formation_by_id(derived.formation_id);
    assignments = derived.assignments; available_players = [player for player in state["players"] if player.id in derived.included_player_ids and derived.player_states[player.id].status != "unavailable"];
    assigned_ids = list(assignments.values()); bench_players = [player for player in available_players if player.id not in assigned_ids and derived.player_states[player.id].status == "bench"];
    team_score = derived.team_score; opponent_score = derived.opponent_score; current_half = derived.current_half;

    def apply(next_game: any) -> bool {
        result = state["replaceMatch"].call(None, next_game); action_error = result; return not bool(result);
    }
    def pause_or_resume {
        if status == "in_progress" { apply(pause_match(game, now)); }
        else { apply(resume_match(game, now)); }
    }
    def set_slot(slot_id: str, next_player_id: str) {
        old_player_id = assignments[slot_id] if slot_id in assignments else ""; previous_slot = "";
        for (slot, assigned_id) in assignments.items() { if assigned_id == next_player_id { previous_slot = slot; } }
        if old_player_id == next_player_id { return; }
        if previous_slot and old_player_id { apply(swap_players(game, previous_slot, slot_id, now)); }
        elif old_player_id and next_player_id { apply(substitute_player(game, next_player_id, slot_id, now)); }
        elif next_player_id { apply(move_player(game, next_player_id, slot_id, now)); }
        elif old_player_id { apply(move_player(game, old_player_id, "BENCH", now)); }
    }
    def record_goal {
        scorer = scorer_id if scorer_id else None; assister = assister_id if assister_id else None;
        next_game = update_goal(game, editing_goal_id, goal_team, False, scorer, assister, None, now) if editing_goal_id else record_goal_action(game, goal_team, False, scorer, assister, None, now);
        if apply(next_game) { scorer_id = ""; assister_id = ""; editing_goal_id = ""; }
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
        editing_goal_id = event.id; goal_team = event.data["team"]; scorer_id = event.data.get("scorer_id") or ""; assister_id = event.data.get("assister_id") or "";
    }
    def edit_note(event: any) {
        revised = window.prompt("Edit match note", event.note or "");
        if revised is not None and revised.strip() { apply(update_note(game, event.id, revised.strip(), now)); }
    }
    def remove_event(event: any) {
        if window.confirm("Delete this " + event.type.replace("_", " ").lower() + " event?") { apply(delete_event(game, event.id, now)); }
    }
    def undo_action { if can_undo(game) { apply(undo_last_action(game, now)); } }
    def change_live_formation(next_id: str) { if next_id != derived.formation_id { apply(change_formation(game, next_id, now).game); } }
    def half_time { apply(go_to_half_time(game, now)); }
    def reset_live {
        if window.confirm("Reset the match and return to setup?") { apply(reset_match_action(game, now)); navigate("/match/" + id + "/setup"); }
    }

    <section className="page live-match"><header className="live-header"><div><p className="eyebrow">{game.title or "Live match"}</p><h1>{game.team_name} vs {game.opponent_name}</h1></div><Link className="button ghost" to="/matches">Matches</Link></header>
        {<p className="error" role="alert">{action_error}</p> if action_error else None}
        <div className="score-clock"><div className="score"><span>{game.team_name}</span><strong>{team_score} – {opponent_score}</strong><span>{game.opponent_name}</span></div><div className="clock"><strong>{clock_label(clock_ms)}</strong><span>Half {current_half} · {status.replace("_", " ")}</span></div>
            <div className="clock-actions">{<button className="button primary" type="button" onClick={pause_or_resume}>{"Pause" if status == "in_progress" else ("Start second half" if status == "half_time" else "Resume")}</button> if status != "ended" else None}{<button className="button secondary" type="button" onClick={half_time}>Half time</button> if status == "in_progress" and game.settings.number_of_halves > 1 and current_half == 1 else None}<button className="button danger" type="button" disabled={status == "ended"} onClick={end_match}>End match</button></div></div>
        <div className="live-grid"><div className="field-column"><section className="live-card"><div className="section-heading"><h2>Field</h2><span>{game.settings.format} · {formation.shape if formation else game.pending_formation_id}</span></div>
            {<div className="live-pitch">{[<label className="live-slot" key={position.id} style={{"left": str(position.x) + "%", "top": str(position.y) + "%"}}><span>{position.label}</span><select value={assignments[position.id] if position.id in assignments else ""} onChange={lambda (e: ChangeEvent) { set_slot(position.id, e.target.value); }}><option value="">Open</option>{[<option key={player.id} value={player.id}>{jersey_label(player.jersey_number)} {player.name}</option> for player in available_players]}</select></label> for position in formation.positions]}</div> if formation else <p className="error">Formation unavailable.</p>}</section>
            <section className="live-card"><h2>Bench</h2>{<div className="bench-list">{[<span className="bench-chip" key={player.id}>{jersey_label(player.jersey_number)} {player.name}</span> for player in bench_players]}</div> if bench_players else <p className="muted">No available players on the bench.</p>}</section></div>
            <aside className="live-sidebar"><section className="live-card"><h2>Formation</h2><select className="input" value={derived.formation_id} disabled={status == "ended"} onChange={lambda (e: ChangeEvent) { change_live_formation(e.target.value); }}>{[<option key={item.id} value={item.id}>{item.shape}</option> for item in formations_for_format(game.settings.format)]}</select></section><section className="live-card"><h2>{"Edit goal" if editing_goal_id else "Record goal"}</h2><div className="form-stack"><label>For<select className="input" value={goal_team} onChange={lambda (e: ChangeEvent) { goal_team = e.target.value; }}><option value="us">{game.team_name}</option><option value="opponent">{game.opponent_name}</option></select></label>{<><label>Scorer (optional)<select className="input" value={scorer_id} onChange={lambda (e: ChangeEvent) { scorer_id = e.target.value; }}><option value="">Uncredited</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in available_players]}</select></label><label>Assist (optional)<select className="input" value={assister_id} onChange={lambda (e: ChangeEvent) { assister_id = e.target.value; }}><option value="">None</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in available_players]}</select></label></> if goal_team == "us" else None}<div className="inline-control"><button className="button primary" type="button" disabled={status == "ended"} onClick={record_goal}>{"Save goal" if editing_goal_id else "Add goal"}</button>{<button className="button ghost" type="button" onClick={lambda { editing_goal_id = ""; scorer_id = ""; assister_id = ""; }}>Cancel</button> if editing_goal_id else None}</div></div></section>
                <section className="live-card"><h2>Card</h2><div className="inline-control"><select className="input" value={card_player_id} onChange={lambda (e: ChangeEvent) { card_player_id = e.target.value; }}><option value="">Choose player</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in available_players]}</select><select className="input color-select" value={card_color} onChange={lambda (e: ChangeEvent) { card_color = e.target.value; }}><option value="yellow">Yellow</option><option value="red">Red</option></select><button className="button secondary" type="button" disabled={status == "ended"} onClick={record_card}>Record</button></div></section>
                <section className="live-card"><h2>Note</h2><div className="inline-control"><input className="input" value={note} placeholder="Add a match note" onChange={lambda (e: ChangeEvent) { note = e.target.value; }} /><button className="button secondary" type="button" disabled={status == "ended"} onClick={add_note}>Add</button></div></section></aside></div>
        <section className="live-card event-log"><div className="section-heading"><h2>Event log</h2><div className="event-toolbar"><button className="button secondary small" type="button" disabled={not can_undo(game)} onClick={undo_action}>Undo last action</button><button className="button ghost small" type="button" onClick={reset_live}>Reset match</button></div></div>{<ol>{[<li key={event.id}><time>{clock_label(event.match_clock_ms)}</time><span>{event_label(event, available_players)}</span><span className="event-actions">{<button className="button ghost small" type="button" onClick={lambda { edit_goal(event); }}>Edit</button> if event.type == "GOAL" else None}{<button className="button ghost small" type="button" onClick={lambda { edit_note(event); }}>Edit</button> if event.type == "NOTE" else None}{<button className="button ghost small" type="button" onClick={lambda { remove_event(event); }}>Delete</button> if can_delete_live_event(event.type) else None}</span></li> for event in game.events]}</ol> if game.events else <p className="muted">No events yet.</p>}</section>
    </section>
}
