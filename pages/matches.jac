import "./matches.css";
import from "@jac/runtime" { useNavigate }
import from ..state.AppState { use_app_state }
import from ..domain.models { Match }
import from ..domain.live_match { derive_match_state }

def status_label(status: str) -> str {
    labels = {"setup": "In setup", "in_progress": "Live", "paused": "Paused", "half_time": "Half-time", "ended": "Final"};
    return labels.get(status, status);
}

def:pub MatchesPage() -> JsxPage {
    state = use_app_state(); navigate = useNavigate(); active_id = state["activeTeamId"]; now = int(Date.now());
    team_matches = [game for game in state["matches"] if game.team_id == active_id];
    active_games = [game for game in team_matches if derive_match_state(game, now).status not in ["setup", "ended"]];
    drafts = [game for game in team_matches if derive_match_state(game, now).status == "setup"];
    completed = [game for game in team_matches if derive_match_state(game, now).status == "ended"];
    def open_game(game: Match) {
        status = derive_match_state(game, int(Date.now())).status;
        navigate("/match/" + game.id + ("/setup" if status == "setup" else "/summary" if status == "ended" else "/live"));
    }
    def remove(game: Match) {
        if window.confirm("Delete " + (game.team_name or "Us") + " vs " + (game.opponent_name or "Opponent") + "? This removes its events and statistics.") {
            state["deleteMatch"].call(None, game.id);
        }
    }
    def rows(items: list[Match]) -> JsxElement {
        return <ul className="saved-lineups">{[<li key={game.id}><button className="match-open" onClick={lambda { open_game(game); }}><strong>{game.team_name or "Us"} vs {game.opponent_name or "Opponent"}{("  " + str(derive_match_state(game, now).team_score) + "–" + str(derive_match_state(game, now).opponent_score)) if derive_match_state(game, now).status == "ended" else ""}</strong><p>{game.date}{(" " + game.kickoff_time) if game.kickoff_time else ""} · {status_label(derive_match_state(game, now).status)} · {game.settings.format}</p></button><button className="button ghost small" onClick={lambda { remove(game); }}>Delete</button></li> for game in items]}</ul>;
    }
    <section className="page narrow-page"><div className="title-row"><div><h1>Match history</h1><p className="muted">Results and details for the active team.</p></div><button className="button primary" onClick={lambda { navigate("/match/new"); }}>+ New match</button></div>
        {<section className="setup-section"><h2>In progress</h2>{rows(active_games)}</section> if active_games else None}
        {<section className="setup-section"><h2>Unfinished setup</h2>{rows(drafts)}</section> if drafts else None}
        <section className="setup-section"><h2>Completed matches</h2>{rows(completed) if completed else <p className="muted">No completed matches yet.</p>}</section>
    </section>
}
