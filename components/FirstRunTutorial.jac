import from "@jac/runtime" { useNavigate }
import from ..state.AppState { use_app_state }

def:pub FirstRunTutorial(open: bool, on_close: any) -> JsxElement {
    state = use_app_state(); navigate = useNavigate();
    owner = localStorage.getItem("teamtrack:onboarding:user") or "local";
    prefix = "teamtrack:onboarding:" + owner + ":";
    has step: str = localStorage.getItem(prefix + "step") or "team";
    has error: str = "";
    has message: str = "";
    team_id = localStorage.getItem(prefix + "team") or str(state["activeTeamId"]);
    team_name = "YOUR TEAM";
    for item in state["teams"] {
        if item.id == team_id { team_name = str(item.name); break; }
    }
    team_lineups = [item for item in state["lineups"] if item.team_id == team_id];
    roster_count = len([item for item in state["players"] if item.team_id == team_id]);
    lineup_saved = any([bool(item.assignments) for item in team_lineups]);
    match_id = localStorage.getItem(prefix + "match-id") or "";
    match_saved = bool(match_id and localStorage.getItem(prefix + "match-saved") == match_id);

    def save_step(next_step: str) {
        step = next_step; localStorage.setItem(prefix + "step", next_step); error = ""; message = "";
    }
    def activate_team {
        state["setActiveTeam"].call(None, team_id);
    }
    def open_roster {
        activate_team(); navigate("/roster");
    }
    def continue_to_roster {
        if roster_count == 0 { error = "Add at least one player to your roster before continuing."; return; }
        save_step("lineup"); activate_team(); navigate("/lineups");
    }
    def open_lineups {
        activate_team(); navigate("/lineups");
    }
    def continue_to_lineup {
        if not lineup_saved { error = "Save a lineup in the Lineups page before continuing."; return; }
        save_step("match"); localStorage.removeItem(prefix + "match-id"); localStorage.removeItem(prefix + "match-saved");
        activate_team();
        navigate("/match/new");
    }
    def open_match_setup {
        activate_team();
        if match_id { navigate("/match/" + match_id + "/setup"); }
        else { navigate("/match/new"); }
    }
    def continue_to_whiteboard {
        if not match_saved { error = "Save your match setup before continuing."; return; }
        save_step("whiteboard"); localStorage.removeItem(prefix + "whiteboard-ready");
        activate_team(); navigate("/whiteboard");
    }
    def open_whiteboard {
        activate_team(); navigate("/whiteboard");
    }
    def finish_whiteboard {
        if localStorage.getItem(prefix + "whiteboard-ready") != "true" {
            error = "Add a line, arrow, or note to the whiteboard before finishing this step.";
            return;
        }
        localStorage.setItem(prefix + "complete", "true");
        localStorage.removeItem(prefix + "active");
        step = "complete";
        message = "You’re all set. Your team, lineup, match, and whiteboard are ready.";
    }
    def pause_guide {
        localStorage.setItem(prefix + "dismissed", "true");
        on_close.call(None);
    }

    if not open { return <></>; }
    if step == "complete" {
        return <aside className="tutorial-guide tutorial-complete" role="status"><p>{message}</p><button type="button" className="button primary small" onClick={lambda { on_close.call(None); }}>Done</button></aside>;
    }
    step_number = 2 if step in ["roster", "lineup"] else 3 if step == "match" else 4;
    return <aside className="tutorial-guide" aria-labelledby="tutorial-title">
        <div className="tutorial-guide-heading">
            <div><p className="tutorial-eyebrow">GETTING STARTED · {team_name}</p><h2 id="tutorial-title">Step {step_number} of 4</h2></div>
            <button type="button" className="button ghost small" onClick={pause_guide}>Pause guide</button>
        </div>
        <progress className="tutorial-progress" value={step_number} max={4} aria-label={"Step " + str(step_number) + " of 4"} />
        {<div className="tutorial-step"><h3>Build your roster</h3><p>Open Roster and add your own players. Enter each player’s name and any details you know; you can add more players later.</p>
            {<p className="tutorial-success" role="status">{str(roster_count)} player{ "" if roster_count == 1 else "s"} on your roster.</p> if roster_count else None}
            <div className="tutorial-actions"><button className="button primary" type="button" onClick={open_roster}>Open roster</button>
                {<button className="button secondary" type="button" onClick={continue_to_roster}>Continue to lineup</button> if roster_count else None}
            </div></div> if step == "roster" else None}
        {<div className="tutorial-step"><h3>Create your first lineup</h3><p>Open Lineups, create a lineup using your roster, and save it. You can arrange players yourself or use Auto-fill by position.</p>
            {<p className="tutorial-success" role="status">Lineup saved. You’re ready to set up a match.</p> if lineup_saved else None}
            <div className="tutorial-actions"><button className="button primary" type="button" onClick={open_lineups}>{ "Open lineup" if not lineup_saved else "Open saved lineup"}</button>
                {<button className="button secondary" type="button" onClick={continue_to_lineup}>Continue to match</button> if lineup_saved else None}
            </div>
        </div> if step == "lineup" else None}
        {<div className="tutorial-step"><h3>Set up your first match</h3><p>Create a real match for {team_name}. Add an opponent, check the date and roster, then save the draft. You can choose the lineup you just created in the starting-lineup section.</p>
            {<p className="tutorial-success" role="status">Match saved. Next, add a tactic to your whiteboard.</p> if match_saved else None}
            <div className="tutorial-actions"><button className="button primary" type="button" onClick={open_match_setup}>{ "Open match setup" if match_id else "Create a match"}</button>
                {<button className="button secondary" type="button" onClick={continue_to_whiteboard}>Continue to whiteboard</button> if match_saved else None}
            </div>
        </div> if step == "match" else None}
        {<div className="tutorial-step"><h3>Add a tactic to your whiteboard</h3><p>Open the team whiteboard and draw a line or arrow, or add a note. Your work is saved automatically for this team.</p>
            <div className="tutorial-actions"><button className="button primary" type="button" onClick={open_whiteboard}>Open whiteboard</button>
                <button className="button secondary" type="button" onClick={finish_whiteboard}>Finish setup</button>
            </div>
        </div> if step == "whiteboard" else None}
        {[<p className="error" role="alert" key={idx}>{item}</p> for (idx, item) in enumerate([error]) if item]}
        {<p className="tutorial-success" role="status">{message}</p> if message else None}
    </aside>;
}
