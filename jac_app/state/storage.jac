"""Browser-local persistence for TeamTrack records."""
import from ..domain.models { Team, Player, SavedLineup, Match }
import from football.models { Formation as FootballFormation, Play as FootballPlay, DrivePlan, Whiteboard as FootballWhiteboard }
glob TEAMS_KEY: str = "teamtrack:jac:teams"; glob PLAYERS_KEY: str = "teamtrack:jac:players";
glob LINEUPS_KEY: str = "teamtrack:jac:lineups"; glob MATCHES_KEY: str = "teamtrack:jac:matches";
glob ACTIVE_TEAM_KEY: str = "teamtrack:jac:active-team-id";
glob FOOTBALL_FORMATIONS_KEY: str = "teamtrack:jac:football-formations";
glob FOOTBALL_PLAYS_KEY: str = "teamtrack:jac:football-plays";
glob DRIVE_PLANS_KEY: str = "teamtrack:jac:drive-plans";
glob FOOTBALL_WHITEBOARDS_KEY: str = "teamtrack:jac:football-whiteboards";
def:pub create_id(prefix: str) -> str { return prefix + "-" + str(int(Date.now())) + "-" + str(Math.random()); }
def:pub save_teams(items: list[Team]) { localStorage.setItem(TEAMS_KEY, JSON.stringify(items)); }
def:pub load_teams() -> list[Team] {
    raw = localStorage.getItem(TEAMS_KEY); if raw { parsed = JSON.parse(raw) as list[Team]; if parsed { return parsed; } }
    now = int(Date.now()); initial = [Team(id=create_id("team"), name="My Team", created_at=now, updated_at=now)]; save_teams(initial); return initial;
}
def:pub save_players(items: list[Player]) { localStorage.setItem(PLAYERS_KEY, JSON.stringify(items)); }
def:pub load_players() -> list[Player] { raw = localStorage.getItem(PLAYERS_KEY); return JSON.parse(raw) as list[Player] if raw else []; }
def:pub save_lineups(items: list[SavedLineup]) { localStorage.setItem(LINEUPS_KEY, JSON.stringify(items)); }
def:pub load_lineups() -> list[SavedLineup] { raw = localStorage.getItem(LINEUPS_KEY); return JSON.parse(raw) as list[SavedLineup] if raw else []; }
def:pub save_matches(items: list[Match]) { localStorage.setItem(MATCHES_KEY, JSON.stringify(items)); }
def:pub load_matches() -> list[Match] { raw = localStorage.getItem(MATCHES_KEY); return JSON.parse(raw) as list[Match] if raw else []; }
def:pub save_football_formations(items: list[FootballFormation]) { localStorage.setItem(FOOTBALL_FORMATIONS_KEY, JSON.stringify(items)); }
def:pub load_football_formations() -> list[FootballFormation] { raw = localStorage.getItem(FOOTBALL_FORMATIONS_KEY); return JSON.parse(raw) as list[FootballFormation] if raw else []; }
def:pub save_football_plays(items: list[FootballPlay]) { localStorage.setItem(FOOTBALL_PLAYS_KEY, JSON.stringify(items)); }
def:pub load_football_plays() -> list[FootballPlay] { raw = localStorage.getItem(FOOTBALL_PLAYS_KEY); return JSON.parse(raw) as list[FootballPlay] if raw else []; }
def:pub save_drive_plans(items: list[DrivePlan]) { localStorage.setItem(DRIVE_PLANS_KEY, JSON.stringify(items)); }
def:pub load_drive_plans() -> list[DrivePlan] { raw = localStorage.getItem(DRIVE_PLANS_KEY); return JSON.parse(raw) as list[DrivePlan] if raw else []; }
def:pub save_football_whiteboards(items: list[FootballWhiteboard]) { localStorage.setItem(FOOTBALL_WHITEBOARDS_KEY, JSON.stringify(items)); }
def:pub load_football_whiteboards() -> list[FootballWhiteboard] { raw = localStorage.getItem(FOOTBALL_WHITEBOARDS_KEY); return JSON.parse(raw) as list[FootballWhiteboard] if raw else []; }
def:pub load_active_team_id(teams: list[Team]) -> str {
    saved = localStorage.getItem(ACTIVE_TEAM_KEY); if saved and any([team.id == saved for team in teams]) { return saved; } return teams[0].id;
}
def:pub save_active_team_id(id: str) { localStorage.setItem(ACTIVE_TEAM_KEY, id); }
