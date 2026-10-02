import "./summary.css";
import from "@jac/runtime" { useNavigate, useParams }
import from ....state.AppState { use_app_state }
import from ....domain.live_match { derive_match_state }
import from ....domain.stats { build_match_summary, describe_event, event_time_label }

def csv_cell(value: any) -> str { return '"' + str(value).replace('"', '""') + '"'; }
def minutes_label(ms: int) -> str { return str(round(ms / 60000, 1)); }

def:pub MatchSummaryPage() -> JsxPage {
    state = use_app_state(); params = useParams(); navigate = useNavigate(); id = str(params["id"]); game = None;
    for item in state["matches"] { if item.id == id { game = item; break; } }
    if not game { return <section className="page narrow-page"><h1>Match not found</h1><button className="button ghost" onClick={lambda { navigate("/matches"); }}>Back to matches</button></section>; }
    derived = derive_match_state(game, int(Date.now())); summary = build_match_summary(game, state["players"], int(Date.now()));
    def export_csv() {
        header = "Player,Jersey,Minutes played,Minutes benched,Goals,Assists,Subs in,Subs out";
        rows = [",".join([csv_cell(item.player_name), csv_cell(item.jersey_number or ""), csv_cell(minutes_label(item.total_field_ms)), csv_cell(minutes_label(item.total_bench_ms)), csv_cell(item.goals), csv_cell(item.assists), csv_cell(item.subs_in), csv_cell(item.subs_out)]) for item in summary.summaries];
        content = "\n".join([header] + rows); anchor: any = document.createElement("a");
        anchor.href = "data:text/csv;charset=utf-8," + encodeURIComponent(content); anchor.download = game.date + "-" + (game.opponent_name or "opponent") + "-players.csv"; anchor.click();
    }
    <section className="page summary-page"><div className="title-row"><h1>Match summary</h1><button className="button ghost" onClick={lambda { navigate("/matches"); }}>Back to matches</button></div>
        <section className="score-card"><div className="summary-meta"><span>{game.title or game.date}</span><strong>{"Full-time" if derived.status == "ended" else "Match details"}</strong></div><div className="score-line"><div><strong>{game.team_name or "Us"}</strong><span>{summary.team_score}</span></div><b>–</b><div><span>{summary.opponent_score}</span><strong>{game.opponent_name or "Opponent"}</strong></div></div></section>
        <section className="summary-section"><h2>Player statistics</h2><div className="table-scroll"><table><thead><tr><th>Player</th><th>Played</th><th>Benched</th><th>Goals</th><th>Assists</th><th>Subs in/out</th></tr></thead><tbody>{[<tr key={item.player_id}><td>{("#" + str(item.jersey_number) + " ") if item.jersey_number is not None else ""}{item.player_name}</td><td>{minutes_label(item.total_field_ms)} min</td><td>{minutes_label(item.total_bench_ms)} min</td><td>{item.goals}</td><td>{item.assists}</td><td>{item.subs_in} / {item.subs_out}</td></tr> for item in summary.summaries]}</tbody></table></div><p className="muted small-text">Team average field time: {str(round(summary.average_field_ms / 60000, 1))} min.</p></section>
        <section className="summary-section"><h2>Event timeline</h2>{<p className="muted">No events recorded.</p> if not game.events else <ol className="event-timeline">{[<li key={event.id}><time>{event_time_label(event)}</time><span>{describe_event(event, state["players"], derived.formation_id)}</span></li> for event in game.events]}</ol>}</section>
        <div className="summary-actions"><button className="button secondary" onClick={export_csv}>Export player summary (CSV)</button><button className="button secondary" onClick={lambda { navigate("/settings"); }}>Full backup / export…</button></div>
    </section>
}
