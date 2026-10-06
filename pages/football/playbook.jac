import "./football.css";
import from "@jac/runtime" { Link, useNavigate }
import from ...state.AppState { use_app_state }
import from ...state.storage { create_id }
import from ...football.domain { new_formation, play_from_formation, duplicate_play }
import from ...football.templates { starter_definitions, starter_play }
import from ...components.FootballField { FootballField }

def:pub FootballPlaybookPage() -> JsxPage {
    state = use_app_state(); navigate = useNavigate(); active = None;
    for team in state["teams"] { if team.id == state["activeTeamId"] { active = team; break; } }
    has search: str = ""; has tag: str = ""; has formation_id: str = "";
    has creating: bool = False; has new_name: str = "New play";
    has removing: any = None; has error: str = "";
    active_id = active.id if active else "";
    can with [active_id] entry { creating = False; removing = None; search = ""; tag = ""; error = ""; }
    plays = [item for item in state["footballPlays"] if active and item.team_id == active.id];
    formations = [item for item in state["footballFormations"] if active and item.team_id == active.id];
    roster = [item for item in state["players"] if active and item.team_id == active.id];
    tags = sorted(set([value for play in plays for value in play.tags if value]));
    visible = [play for play in plays if (not tag or tag in play.tags) and search.lower() in (play.name + " " + play.description + " " + " ".join(play.tags)).lower()];
    selected = None;
    for item in formations { if item.id == formation_id { selected = item; break; } }
    concepts = starter_definitions();
    def save_new(source: any, name: str, description: str = "") {
        if not active { return; }
        base = source if source else new_formation(active.id, create_id("formation"), [create_id("slot") for _ in range(7)], int(Date.now()));
        play = play_from_formation(base, create_id("play"), create_id("action"), int(Date.now()));
        play.name = name.strip(); play.description = description;
        result = state["saveFootballPlay"].call(None, play); error = result;
        if not result { creating = False; navigate("/football/plays/" + play.id); }
    }
    def duplicate(item: any) {
        copy = duplicate_play(item, create_id("play"), int(Date.now()));
        result = state["saveFootballPlay"].call(None, copy); error = result;
        if not result { navigate("/football/plays/" + copy.id); }
    }
    def use_starter(name: str) {
        if not active { return; }
        play = starter_play(active.id, name, create_id("play"), [create_id("slot") for _ in range(7)], create_id("action"), create_id("action"), int(Date.now()));
        result = state["saveFootballPlay"].call(None, play); error = result;
        if not result { navigate("/football/plays/" + play.id); }
    }
    def starter_preview(name: str) -> JsxElement {
        if not active { return <div />; }
        play = starter_play(active.id, name, name, [name + str(index) for index in range(7)], name + "-snap", name + "-exchange", 0);
        return <FootballField item={play} roster={[]} actions={play.ball_actions} />;
    }
    def delete_selected {
        if removing { state["deleteFootballPlay"].call(None, removing.id); removing = None; }
    }
    if not active or active.sport != "football" { return <section className="page narrow-page"><h1>Playbook</h1><p>Choose a football team first.</p><Link to="/">Dashboard</Link></section>; }
    <section className="page football-page football-library">
        <h1>{active.name + " playbook"}</h1><p className="muted">Editable 7v7 flag plays. Start with a formation or a common concept, then make it yours.</p>
        {<p className="error" role="alert">{error}</p> if error else None}
        <div className="football-intro-actions"><button className="button primary" onClick={lambda { formation_id = formations[0].id if formations else ""; new_name = "New play"; error = ""; creating = True; }}>New play</button><p className="muted">Choose a saved formation when you create a new play.</p></div>
        <div className="football-filters"><input aria-label="Search plays" className="input" type="search" placeholder="Search plays, notes, tags" value={search} onChange={lambda (e: ChangeEvent) { search = e.target.value; }} /><select aria-label="Filter plays by tag" className="input" value={tag} onChange={lambda (e: ChangeEvent) { tag = e.target.value; }}><option value="">All tags</option>{[<option key={value} value={value}>{value}</option> for value in tags]}</select></div>
        {<p className="muted">{"No matching plays." if plays else "Your playbook is empty. Create a play or choose a starter below."}</p> if not visible else None}
        <div className="football-cards">{[<article className="football-card" key={play.id}><Link to={"/football/plays/" + play.id} aria-label={"Edit " + play.name}><FootballField item={play} roster={roster} drawings={play.drawings} actions={play.ball_actions} /><h2>{play.name}</h2></Link><p className="muted football-tags">{" · ".join([value for value in play.tags if value])}</p><div className="actions"><button className="button secondary small" onClick={lambda { duplicate(play); }}>Duplicate</button><button className="button ghost small" onClick={lambda { removing = play; }}>Delete</button></div></article> for play in visible]}</div>
        <section className="football-starters"><h2>Starter concepts</h2><p className="muted">Original 7v7 adaptations. Loading a starter creates your own editable copy. Adjust blocking and ball exchanges for your league.</p><div className="football-cards">{[<article className="football-card" key={concept["name"]}><details><summary>{concept["name"]}</summary>{starter_preview(concept["name"])}<p className="muted">{concept["description"]}</p></details><button className="button secondary small" onClick={lambda { use_starter(concept["name"]); }}>{"Use " + concept["name"]}</button></article> for concept in concepts]}</div></section>
        {<div className="football-dialog-backdrop"><div className="football-dialog" role="dialog" aria-modal={True} aria-label="Create a play"><h2>Create a play</h2><label>Play name<input className="input" value={new_name} onChange={lambda (e: ChangeEvent) { new_name = e.target.value; }} /></label><label>Starting formation<select className="input" value={formation_id} onChange={lambda (e: ChangeEvent) { formation_id = e.target.value; }}><option value="">Default spread (start from scratch)</option>{[<option key={item.id} value={item.id}>{item.name}</option> for item in formations]}</select></label>{<><p className="muted">Copies this formation's positions, roster assignments, quarterback, and snapper. You can edit them in your new play.</p><div className="football-dialog-preview"><FootballField item={selected} roster={roster} /></div></> if selected else <p className="muted">Start with seven unassigned slots, then use Autofill from roster in the editor.</p>}{<p>No saved formations yet. <Link to="/football/formations">Create a formation</Link> first to reuse your lineup.</p> if not formations else None}{<p className="error" role="alert">{error}</p> if error else None}<div className="actions"><button className="button ghost" onClick={lambda { creating = False; }}>Cancel</button><button className="button primary" disabled={not new_name.strip()} onClick={lambda { save_new(selected, new_name); }}>Create play</button></div></div></div> if creating else None}
        {<div className="football-dialog-backdrop"><div className="football-dialog" role="dialog" aria-modal={True} aria-label="Delete play?"><h2>Delete play?</h2><p className="muted">This also removes its entries from saved drive plans.</p><p>{removing.name}</p><div className="actions"><button className="button ghost" onClick={lambda { removing = None; }}>Cancel</button><button className="button danger" onClick={delete_selected}>Delete play</button></div></div></div> if removing else None}
    </section>
}
