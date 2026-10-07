import "../football.css";
import from "@jac/runtime" { Link, useNavigate, useParams }
import from ....state.AppState { use_app_state }
import from ....components.FootballEditor { FootballEditor }

def:pub FootballPlayEditorPage() -> JsxPage {
    state = use_app_state(); navigate = useNavigate(); params = useParams(); id = str(params["id"]);
    play = None;
    for item in state["footballPlays"] { if item.id == id and item.team_id == state["activeTeamId"] { play = item; break; } }
    roster = [item for item in state["players"] if play and item.team_id == play.team_id];
    if not play { return <section className="page narrow-page"><h1>Play not found for this team.</h1><Link to="/football/playbook">Back to playbook</Link></section>; }
    <FootballEditor key={play.id} initial={play} roster={roster} formation_only={False} on_close={lambda { navigate("/football/playbook"); }} />
}
