import "./football.css";
import from "@jac/runtime" { Link, useNavigate }
import from ...state.AppState { use_app_state }
import from ...state.storage { create_id }
import from ...football.domain { new_formation, play_from_formation }
import from ...components.FootballField { FootballField }
import from ...components.FootballEditor { FootballEditor }

def:pub FootballFormationsPage() -> JsxPage {
    state = use_app_state(); navigate = useNavigate(); active = None;
    for team in state["teams"] { if team.id == state["activeTeamId"] { active = team; break; } }
    has draft: any = None; has error: str = ""; has removing: any = None;
    active_id = active.id if active else "";
    can with [active_id] entry { draft = None; removing = None; error = ""; }
    formations = [item for item in state["footballFormations"] if active and item.team_id == active.id];
    roster = [player for player in state["players"] if active and player.team_id == active.id];
    def new_draft {
        if not active { return; }
        draft = new_formation(active.id, create_id("formation"), [create_id("slot") for _ in range(7)], int(Date.now())); error = "";
    }
    def create_play(item: any) {
        play = play_from_formation(item, create_id("play"), create_id("action"), int(Date.now()));
        result = state["saveFootballPlay"].call(None, play); error = result;
        if not result { navigate("/football/plays/" + play.id); }
    }
    if not active or active.sport != "football" { return <section className="page narrow-page"><h1>Football formations</h1><p>Choose a football team first.</p><Link to="/">Dashboard</Link></section>; }
    if draft is not None { return <FootballEditor key={draft.id} initial={draft} roster={roster} formation_only={True} on_close={lambda { draft = None; }} />; }
    <section className="page football-page football-library"><div className="title-row"><h1>Football formations</h1><button className="button primary" type="button" onClick={new_draft}>New formation</button></div><p className="muted">Seven offensive slots with one QB and one snapper. Any other slot can receive, run, or block. Assign your roster, then build plays from a saved formation.</p>{<p className="error" role="alert">{error}</p> if error else None}{<p>No saved formations yet.</p> if not formations else None}<div className="football-cards">{[<article className="football-card" key={item.id}><FootballField item={item} roster={roster} drawings={[]} actions={[]} /><h2>{item.name}</h2><div className="actions"><button className="button secondary small" onClick={lambda { draft = structuredClone(item); error = ""; }}>Edit formation</button><button className="button primary small" onClick={lambda { create_play(item); }}>Create play</button><button className="button ghost small" onClick={lambda { removing = item; }}>Delete</button></div></article> for item in formations]}</div>{<div className="football-dialog-backdrop"><div className="football-dialog" role="dialog" aria-modal={True} aria-label="Delete formation?"><h2>Delete formation?</h2><p className="muted">Saved plays keep their own positions and assignments.</p><p>{removing.name}</p><div className="actions"><button className="button ghost" onClick={lambda { removing = None; }}>Cancel</button><button className="button danger" onClick={lambda { state["deleteFootballFormation"].call(None, removing.id); removing = None; }}>Delete formation</button></div></div></div> if removing else None}</section>
}
