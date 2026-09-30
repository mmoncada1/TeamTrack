import from "@jac/runtime" { useNavigate }
import from ..state.AppState { use_app_state }
def HubCard(title: str, detail: str, path: str, accent: bool, navigate: any) -> JsxElement {
    return <button type="button" className={"hub-card accent" if accent else "hub-card"} onClick={lambda { navigate(path); }}><span className="hub-title">{title}</span><span className="hub-detail">{detail}</span></button>;
}
def:pub DashboardPage() -> JsxPage {
    navigate = useNavigate(); state = use_app_state(); active = None;
    for item in state["teams"] { if item.id == state["activeTeamId"] { active = item; break; } }
    player_count = len([player for player in state["players"] if active and player.team_id == active.id]);
    lineup_count = len([lineup for lineup in state["lineups"] if active and lineup.team_id == active.id]);
    drafts = [game for game in state["matches"] if active and game.team_id == active.id and not game.events];
    <section className="page narrow-page"><div className="page-heading"><div className="team-avatar">TT</div><div><h1>{active.name if active else "TeamTrack"}</h1><p>Team manager</p></div></div>
        {<div className="migration-banner"><strong>Unfinished match setup</strong><p>{drafts[0].team_name} vs {drafts[0].opponent_name or "Opponent"}</p><button className="button primary small" onClick={lambda { navigate("/match/" + drafts[0].id + "/setup"); }}>Continue setup</button></div> if drafts else None}
        <div className="hub-grid">{HubCard("Create new match", "Set up an opponent, kickoff, and starting lineup.", "/match/new", True, navigate)}
            {HubCard("Roster", str(player_count) + " player" + ("" if player_count == 1 else "s") + " on the team.", "/roster", False, navigate)}
            {HubCard("Lineups", (str(lineup_count) + " saved lineup" + ("" if lineup_count == 1 else "s") + " ready to use.") if lineup_count else "Build a starting lineup before match day.", "/lineups", False, navigate)}
            {HubCard("Match history", (str(len(drafts)) + " unfinished setup" + ("" if len(drafts) == 1 else "s") + ".") if drafts else "Results and recaps show up here.", "/matches", False, navigate)}
            {HubCard("Team management", "Team name, photo, and co-ed rules.", "/team/settings", False, navigate)}{HubCard("Whiteboard", "Draw tactics on a pitch.", "/whiteboard", False, navigate)}</div>
    </section>
}

