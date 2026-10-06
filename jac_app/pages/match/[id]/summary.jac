import "./summary.css";
import from "@jac/runtime" { useNavigate, useParams }
import from ....state.AppState { use_app_state }
import from ....domain.live_match { derive_match_state, record_goal, update_goal, delete_event }
import from ....domain.stats { build_match_summary, describe_event, event_time_label }

def csv_cell(value: any) -> str { return '"' + str(value).replace('"', '""') + '"'; }
def minutes_label(ms: int) -> str { return str(round(ms / 60000, 1)); }

def:pub MatchSummaryPage() -> JsxPage {
    state = use_app_state(); params = useParams(); navigate = useNavigate(); id = str(params["id"]); game = None;
    for item in state["matches"] { if item.id == id { game = item; break; } }
    if not game { return <section className="page narrow-page"><h1>Match not found</h1><button className="button ghost" onClick={lambda { navigate("/matches"); }}>Back to matches</button></section>; }
    derived = derive_match_state(game, int(Date.now())); summary = build_match_summary(game, state["players"], int(Date.now()));
    has editing_goal_id: str = ""; has goal_team: str = "us"; has own_goal: bool = False; has scorer_id: str = ""; has assister_id: str = ""; has goal_error: str = "";
    match_players = [player for player in state["players"] if player.id in derived.included_player_ids];
    def edit_goal(event: any) {
        editing_goal_id = event.id; goal_team = event.data["team"]; own_goal = bool(event.data.get("is_own_goal"));
        scorer_id = event.data.get("scorer_id") or ""; assister_id = event.data.get("assister_id") or "";
    }
    def save_goal {
        try {
            next_game = update_goal(game, editing_goal_id, goal_team, own_goal if goal_team == "us" else False, scorer_id or None, assister_id or None, None, int(Date.now())) if editing_goal_id else record_goal(game, goal_team, own_goal if goal_team == "us" else False, scorer_id or None, assister_id or None, None, int(Date.now()));
            goal_error = state["replaceMatch"].call(None, next_game);
            if not goal_error { editing_goal_id = ""; scorer_id = ""; assister_id = ""; own_goal = False; }
        } except Exception { goal_error = "Could not save the goal. Check the scorer and assist."; }
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
    <section className="page summary-page"><div className="title-row"><h1>Match summary</h1><button className="button ghost" onClick={lambda { navigate("/matches"); }}>Back to matches</button></div>
        <section className="score-card"><div className="summary-meta"><span>{game.title or game.date}</span><strong>{"Full-time" if derived.status == "ended" else "Match details"}</strong></div><div className="score-line"><div><strong>{game.team_name or "Us"}</strong><span>{summary.team_score}</span></div><b>–</b><div><span>{summary.opponent_score}</span><strong>{game.opponent_name or "Opponent"}</strong></div></div></section>
        <section className="summary-section"><h2>Player statistics</h2><div className="table-scroll"><table><thead><tr><th>Player</th><th>Played</th><th>Benched</th><th>Goals</th><th>Assists</th><th>Subs in/out</th></tr></thead><tbody>{[<tr key={item.player_id}><td>{("#" + str(item.jersey_number) + " ") if item.jersey_number is not None else ""}{item.player_name}</td><td>{minutes_label(item.total_field_ms)} min</td><td>{minutes_label(item.total_bench_ms)} min</td><td>{item.goals}</td><td>{item.assists}</td><td>{item.subs_in} / {item.subs_out}</td></tr> for item in summary.summaries]}</tbody></table></div><p className="muted small-text">Team average field time: {str(round(summary.average_field_ms / 60000, 1))} min.</p></section>
        <section className="summary-section"><h2>{"Edit goal" if editing_goal_id else "Correct a missed goal"}</h2>{<p className="error" role="alert">{goal_error}</p> if goal_error else None}<div className="form-stack"><label>Goal for<select className="input" value={goal_team} onChange={lambda (e: ChangeEvent) { goal_team = e.target.value; }}><option value="us">{game.team_name}</option><option value="opponent">{game.opponent_name}</option></select></label>{<label className="inline-control"><input type="checkbox" checked={own_goal} onChange={lambda (e: ChangeEvent) { own_goal = e.target.checked; }} /> Own goal by our team</label> if goal_team == "us" else None}{<><label>Scorer<select className="input" value={scorer_id} onChange={lambda (e: ChangeEvent) { scorer_id = e.target.value; }}><option value="">Uncredited</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in match_players]}</select></label><label>Assist<select className="input" value={assister_id} onChange={lambda (e: ChangeEvent) { assister_id = e.target.value; }}><option value="">None</option>{[<option key={player.id} value={player.id}>{player.name}</option> for player in match_players]}</select></label></> if goal_team == "us" else None}<div className="inline-control"><button className="button primary" type="button" onClick={save_goal}>{"Save goal" if editing_goal_id else "Add goal"}</button>{<button className="button ghost" type="button" onClick={lambda { editing_goal_id = ""; scorer_id = ""; assister_id = ""; own_goal = False; }}>Cancel edit</button> if editing_goal_id else None}</div></div><ul>{[<li key={event.id}>{describe_event(event, state["players"], derived.formation_id)} <button className="button ghost small" type="button" onClick={lambda { edit_goal(event); }}>Edit</button><button className="button danger small" type="button" onClick={lambda { remove_goal(event); }}>Delete</button></li> for event in game.events if event.type == "GOAL"]}</ul></section>
        <section className="summary-section"><h2>Event timeline</h2>{<p className="muted">No events recorded.</p> if not game.events else <ol className="event-timeline">{[<li key={event.id}><time>{event_time_label(event)}</time><span>{describe_event(event, state["players"], derived.formation_id)}</span></li> for event in game.events]}</ol>}</section>
        <div className="summary-actions"><button className="button secondary" onClick={export_csv}>Export player summary (CSV)</button><button className="button secondary" onClick={lambda { navigate("/settings"); }}>Full backup / export…</button></div>
    </section>
}
