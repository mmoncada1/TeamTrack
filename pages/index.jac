import "./football/football.css";
import from "@jac/runtime" { Link, useNavigate }
import from ..domain.live_match { derive_match_state }
import from ..state.AppState { use_app_state }
def HubCard(title: str, detail: str, path: str, accent: bool, navigate: any) -> JsxElement {
    return <button type="button" className={"hub-card accent" if accent else "hub-card"} onClick={lambda { navigate(path); }}><span className="hub-title">{title}</span><span className="hub-detail">{detail}</span></button>;
}
def:pub DashboardPage() -> JsxPage {
    navigate = useNavigate(); state = use_app_state(); active = None;
    for item in state["teams"] { if item.id == state["activeTeamId"] { active = item; break; } }
    player_count = len([player for player in state["players"] if active and player.team_id == active.id]);
    lineup_count = len([lineup for lineup in state["lineups"] if active and lineup.team_id == active.id]);
    team_matches = [game for game in state["matches"] if active and game.team_id == active.id]; now = int(Date.now());
    live_games = [game for game in team_matches if derive_match_state(game, now).status not in ["setup", "ended"]];
    played_count = len([game for game in team_matches if derive_match_state(game, now).status == "ended"]);
    if active and active.sport == "football" {
        formation_count = len([item for item in state["footballFormations"] if item.team_id == active.id]);
        play_count = len([item for item in state["footballPlays"] if item.team_id == active.id]);
        drive_count = len([item for item in state["drivePlans"] if item.team_id == active.id]);
        steps = [("/roster", "Roster", str(player_count), "Add your flag football players."), ("/football/formations", "Formations", str(formation_count), "Position seven players and designate a QB and snapper."), ("/football/playbook", "Playbook", str(play_count), "Create a play or load an editable starter concept."), ("/football/drives", "Drive plans", str(drive_count), "Arrange plays into an ordered call sheet."), ("/whiteboard", "Whiteboard", "", "Draw freely on a blank football field.")];
        return <section className="page football-dashboard"><h1>{active.name + " · 7v7 flag football"}</h1><p className="muted">Build your roster, set a formation, design plays, and plan your next drive.</p><div className="football-dashboard-grid">{[<Link key={step[0]} to={step[0]} className="football-dashboard-card"><h2>{step[1] + (" (" + step[2] + ")" if step[2] else "")}</h2><p>{step[3]}</p></Link> for step in steps]}</div></section>;
    }
    <section className="page narrow-page"><div className="page-heading">{<img className="team-avatar image" src={active.photo_id} alt={"Photo of " + active.name} /> if active and active.photo_id else <div className="team-avatar">{active.name.strip()[:2].upper() if active and active.name.strip() else "TT"}</div>}<div><h1>{active.name if active else "TeamTrack"}</h1><p>Team manager</p></div></div>
        {<div className="migration-banner"><div><strong>Match in progress</strong><p>{live_games[0].team_name or "Us"} vs {live_games[0].opponent_name or "Opponent"}</p></div><button className="button primary small" onClick={lambda { navigate("/match/" + live_games[0].id + "/live"); }}>Resume match</button></div> if live_games else None}
        <div className="hub-grid">{HubCard("Create new match", "Set up an opponent, kickoff, and starting lineup.", "/match/new", True, navigate)}
            {HubCard("Roster", str(player_count) + " player" + ("" if player_count == 1 else "s") + " on the team.", "/roster", False, navigate)}
            {HubCard("Lineups", (str(lineup_count) + " saved lineup" + ("" if lineup_count == 1 else "s") + " ready to use.") if lineup_count else "Build a starting lineup before match day.", "/lineups", False, navigate)}
            {HubCard("Match history", (str(played_count) + " completed match" + ("" if played_count == 1 else "es") + ".") if played_count else "Results and recaps show up here.", "/matches", False, navigate)}
            {HubCard("Team management", "Team name, photo, and co-ed rules.", "/team/settings", False, navigate)}{HubCard("Whiteboard", "Draw tactics on a pitch.", "/whiteboard", False, navigate)}</div>
    </section>
}
