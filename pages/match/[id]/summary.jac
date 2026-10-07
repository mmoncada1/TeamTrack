import "./summary.css";
import from "@jac/runtime" { useNavigate, useParams }
import from ....state.AppState { use_app_state }
import from ....domain.live_match { derive_match_state, record_goal, update_goal, delete_event }
import from ....domain.stats { build_match_summary, describe_event, event_time_label }

def csv_cell(value: any) -> str { return '"' + str(value).replace('"', '""') + '"'; }
def minutes_label(ms: int) -> str { return str(round(ms / 60000, 1)); }

def initials(name: str) -> str {
    parts = name.strip().split();
    if not parts { return "?"; }
    return (parts[0][:2] if len(parts) == 1 else parts[0][:1] + parts[1][:1]).upper();
}
def player_name(players: list[any], id: str | None) -> str {
    if id { for player in players { if player.id == id { return player.name; } } }
    return "Goal";
}
def goal_text(event: any, players: list[any]) -> str {
    scorer = event.data.get("scorer_id"); assist = event.data.get("assister_id");
    if event.data.get("is_own_goal", False) { return (player_name(players, scorer) + " (og)") if scorer else "Own goal"; }
    if event.data.get("team") == "opponent" { return "Goal"; }
    return player_name(players, scorer) + ((" (" + player_name(players, assist) + ")") if assist else "");
}
def goal_minute(event: any, half_length: int) -> str {
    minutes = int(event.match_clock_ms / 60000) + 1;
    if minutes > half_length and half_length > 0 { return str(half_length) + "+" + str(minutes - half_length) + "'"; }
    return str(minutes) + "'";
}
def goal_menu_label(event: any, players: list[any]) -> str {
    if event.data.get("is_own_goal", False) {
        scorer = event.data.get("scorer_id");
        return "Own goal (against us)" + ((" involving " + player_name(players, scorer)) if scorer else "") + ".";
    }
    return describe_event(event, players);
}
def clock_text(ms: int) -> str {
    minutes = int(ms / 60000); seconds = int(ms / 1000) % 60;
    return str(minutes) + ":" + ("0" if seconds < 10 else "") + str(seconds);
}
def:pub MatchSummaryPage() -> JsxPage {
    state = use_app_state(); params = useParams(); navigate = useNavigate(); id = str(params["id"]); game = None;
    for item in state["matches"] { if item.id == id { game = item; break; } }
    if not game { return <section className="page narrow-page"><h1>Match not found</h1><button className="button ghost" onClick={lambda { navigate("/matches"); }}>Back to matches</button></section>; }
    derived = derive_match_state(game, int(Date.now())); summary = build_match_summary(game, state["players"], int(Date.now()));
    has editing_goal_id: str = ""; has goal_team: str = "us"; has own_goal: bool = False; has scorer_id: str = ""; has assister_id: str = ""; has goal_error: str = ""; has edit_menu_open: bool = False; has goal_form_open: bool = False; has goal_clock: str = "";
    match_players = [player for player in state["players"] if player.id in derived.included_player_ids];
    team = None;
    for item in state["teams"] { if item.id == game.team_id { team = item; break; } }
    goal_events = [event for event in game.events if event.type == "GOAL"];
    goal_ours = [event for event in goal_events if event.data.get("team") == "us" and not event.data.get("is_own_goal", False)];
    goal_theirs = [event for event in goal_events if event.data.get("team") == "opponent" or event.data.get("is_own_goal", False)];
    browser: any = window; date_class: any = browser.Date; match_date: any = new(date_class, game.date + "T12:00:00");
    date_label = match_date.toLocaleDateString("en-US", {"weekday": "short", "month": "short", "day": "numeric"});
    def open_new_goal {
        editing_goal_id = ""; goal_team = "us"; own_goal = False; scorer_id = ""; assister_id = "";
        goal_clock = clock_text(summary.match_clock_ms); goal_error = ""; edit_menu_open = False; goal_form_open = True;
    }
    def edit_goal(event: any) {
        editing_goal_id = event.id; goal_team = event.data["team"]; own_goal = bool(event.data.get("is_own_goal"));
        scorer_id = event.data.get("scorer_id") or ""; assister_id = event.data.get("assister_id") or "";
        goal_clock = clock_text(event.match_clock_ms); goal_error = ""; edit_menu_open = False; goal_form_open = True;
    }
    def close_goal_form { goal_form_open = False; editing_goal_id = ""; goal_error = ""; edit_menu_open = True; }
    def save_goal {
        if goal_team == "us" and not own_goal and not scorer_id { goal_error = "Select the scorer."; return; }
        if scorer_id and assister_id and scorer_id == assister_id and not own_goal { goal_error = "The scorer and assister cannot be the same player."; return; }
        parts = goal_clock.strip().split(":");
        try {
            if len(parts) != 2 { goal_error = "Enter the time as minutes:seconds."; return; }
            minutes = int(parts[0]); seconds = int(parts[1]);
            if minutes < 0 or seconds < 0 or seconds > 59 { goal_error = "Enter a valid match time."; return; }
            clock_ms = (minutes * 60 + seconds) * 1000;
            scorer = scorer_id if scorer_id and goal_team == "us" else None;
            assister = assister_id if assister_id and goal_team == "us" and not own_goal else None;
            next_game = update_goal(game, editing_goal_id, goal_team, own_goal, scorer, assister, None, int(Date.now()), clock_ms) if editing_goal_id else record_goal(game, goal_team, own_goal, scorer, assister, None, int(Date.now()), clock_ms);
            goal_error = state["replaceMatch"].call(None, next_game);
            if not goal_error { goal_form_open = False; edit_menu_open = True; editing_goal_id = ""; scorer_id = ""; assister_id = ""; own_goal = False; }
        } except Exception { goal_error = "Could not save the goal. Check the scorer, assist, and time."; }
    }
    def remove_goal(event: any) {
        if window.confirm("Delete this goal from the finished match?") {
            goal_error = state["replaceMatch"].call(None, delete_event(game, event.id, int(Date.now())));
            if editing_goal_id == event.id { editing_goal_id = ""; }
        }
    }
    def export_csv() {
        header = "Player,Jersey,Minutes played,Minutes benched,Goals,Assists,Subs in,Subs out";
        rows = [",".join([csv_cell(item.player_name), csv_cell(item.jersey_number or ""), csv_cell(minutes_label(item.total_field_ms)), csv_cell(minutes_label(item.total_bench_ms)), csv_cell(item.goals), csv_cell(item.assists), csv_cell(item.subs_in), csv_cell(item.subs_out)]) for item in summary.summaries];
        content = "\n".join([header] + rows); anchor: any = document.createElement("a");
        anchor.href = "data:text/csv;charset=utf-8," + encodeURIComponent(content); anchor.download = game.date + "-" + (game.opponent_name or "opponent") + "-players.csv"; anchor.click();
    }
    <section className="page summary-page"><div className="summary-header"><h1>Match summary</h1><div className="summary-header-actions"><button className="button secondary" type="button" onClick={lambda { edit_menu_open = True; }}>Edit</button><button className="button ghost" type="button" onClick={lambda { navigate("/"); }}>Back to dashboard</button></div></div>
        <section className="score-card"><div className="summary-meta"><span>{(game.title + " · ") if game.title else ""}{date_label}</span><span>{"Full-time" if derived.status == "ended" else "Match details"}</span></div><div className="score-line"><div className="summary-team our-team"><div className="summary-team-mark">{<img src={team.photo_id} alt={"Photo of " + game.team_name} /> if team is not None and team.photo_id else initials(game.team_name or "Us")}</div><strong>{game.team_name or "Us"}</strong></div><span className="summary-score">{summary.team_score}</span><span className="summary-dash">–</span><span className="summary-score">{summary.opponent_score}</span><div className="summary-team opponent-team"><div className="summary-team-mark">{initials(game.opponent_name or "Opponent")}</div><strong>{game.opponent_name or "Opponent"}</strong></div></div><div className="goal-recap"><ul>{[<li key={event.id}><span aria-hidden={True}>⚽</span> {goal_text(event, state["players"])} {goal_minute(event, game.settings.half_length_minutes)}</li> for event in goal_ours]}</ul><ul>{[<li key={event.id}><span aria-hidden={True}>⚽</span> {goal_text(event, state["players"])} {goal_minute(event, game.settings.half_length_minutes)}</li> for event in goal_theirs]}</ul></div></section>
        <section className="summary-section player-statistics"><h2>Player statistics</h2><table><thead><tr><th>Player</th><th>Minutes played</th><th>Minutes benched</th><th>Goals</th><th>Assists</th><th>Subs in/out</th></tr></thead><tbody>{[<tr key={item.player_id}><td><div className="summary-player-cell">{[<img className="summary-player-avatar" src={player.photo_id} alt={"Photo of " + player.name} /> if player.photo_id else <span className="summary-player-avatar">{initials(player.name)}</span> for player in match_players if player.id == item.player_id]}<span>{("#" + str(item.jersey_number) + " ") if item.jersey_number is not None else ""}{item.player_name}</span></div></td><td>{minutes_label(item.total_field_ms)}</td><td>{minutes_label(item.total_bench_ms)}</td><td>{item.goals}</td><td>{item.assists}</td><td>{item.subs_in} / {item.subs_out}</td></tr> for item in summary.summaries]}</tbody></table><p className="muted small-text">Team average field time: {minutes_label(int(summary.average_field_ms))} min.</p></section>
        <section className="summary-section"><h2>Event timeline</h2>{<p className="muted">No events recorded.</p> if not game.events else <ol className="event-timeline">{[<li key={event.id}><time>{event_time_label(event)}</time><span>{describe_event(event, state["players"], derived.formation_id)}</span></li> for event in game.events]}</ol>}</section>
        <div className="summary-actions"><button className="button secondary" onClick={export_csv}>Export player summary (CSV)</button><button className="button secondary" onClick={lambda { navigate("/settings"); }}>Full backup / export…</button></div>
        {<div className="summary-modal-backdrop" onClick={lambda { edit_menu_open = False; }}><section className="summary-goal-modal" role="dialog" aria-modal={True} aria-label="Edit goals" onClick={lambda (e: MouseEvent) { e.stopPropagation(); }}><h2>Edit goals</h2><p>Add a goal, or change the scorer, assist, and time.</p>{<ul className="summary-goal-list">{[<li key={event.id}><span>{goal_menu_label(event, state["players"])} {event_time_label(event)}</span><div><button className="button ghost small" type="button" onClick={lambda { edit_goal(event); }}>Edit</button><button className="button ghost small" type="button" onClick={lambda { remove_goal(event); }}>Remove</button></div></li> for event in goal_events]}</ul> if goal_events else <p className="summary-no-goals">No goals yet.</p>}{<p className="summary-goal-error" role="alert">{goal_error}</p> if goal_error else None}<div className="summary-modal-footer"><button className="button ghost" type="button" onClick={lambda { edit_menu_open = False; }}>Done</button><button className="button primary" type="button" onClick={open_new_goal}>Add goal</button></div></section></div> if edit_menu_open else None}
        {<div className="summary-modal-backdrop" onClick={close_goal_form}><section className="summary-goal-modal summary-goal-form" role="dialog" aria-modal={True} aria-label={"Edit goal" if editing_goal_id else "Add goal"} onClick={lambda (e: MouseEvent) { e.stopPropagation(); }}><h2>{"Edit goal" if editing_goal_id else "Add goal"}</h2><fieldset><legend>Goal type</legend><div className="summary-goal-kinds"><label><input type="radio" name="summary-goal-kind" checked={goal_team == "us" and not own_goal} onChange={lambda { goal_team = "us"; own_goal = False; }} /> Our goal</label><label><input type="radio" name="summary-goal-kind" checked={goal_team == "opponent"} onChange={lambda { goal_team = "opponent"; own_goal = False; }} /> Opponent goal</label><label><input type="radio" name="summary-goal-kind" checked={own_goal} onChange={lambda { goal_team = "us"; own_goal = True; assister_id = ""; }} /> Own goal (against us)</label></div></fieldset>{<label className="summary-goal-field">{"Player responsible (optional)" if own_goal else "Scorer"}<select className="input" value={scorer_id} onChange={lambda (e: ChangeEvent) { scorer_id = e.target.value; }}><option value="">{"— Not recorded —" if own_goal else "— Select scorer —"}</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in match_players]}</select></label> if goal_team == "us" else None}{<label className="summary-goal-field">Assist (optional)<select className="input" value={assister_id} onChange={lambda (e: ChangeEvent) { assister_id = e.target.value; }}><option value="">— No assist —</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in match_players]}</select></label> if goal_team == "us" and not own_goal else None}<label className="summary-goal-field">Match time (minutes:seconds)<input className="input" type="text" inputMode="numeric" placeholder="29:56" value={goal_clock} onChange={lambda (e: ChangeEvent) { goal_clock = e.target.value; }} /></label>{<p className="summary-goal-error" role="alert">{goal_error}</p> if goal_error else None}<div className="summary-modal-footer"><button className="button ghost" type="button" onClick={close_goal_form}>Cancel</button><button className="button primary" type="button" onClick={save_goal}>{"Save changes" if editing_goal_id else "Save goal"}</button></div></section></div> if goal_form_open else None}
    </section>
}
