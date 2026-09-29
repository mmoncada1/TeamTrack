"""Browser-local persistence for teams, players, and saved lineups."""
import from ..domain.models { Team, Player, SavedLineup }
glob TEAMS_KEY: str = "teamtrack:jac:teams";
glob PLAYERS_KEY: str = "teamtrack:jac:players";
glob LINEUPS_KEY: str = "teamtrack:jac:lineups";
glob ACTIVE_TEAM_KEY: str = "teamtrack:jac:active-team-id";
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
def:pub load_active_team_id(teams: list[Team]) -> str {
    saved = localStorage.getItem(ACTIVE_TEAM_KEY); if saved and any([team.id == saved for team in teams]) { return saved; } return teams[0].id;
}
def:pub save_active_team_id(id: str) { localStorage.setItem(ACTIVE_TEAM_KEY, id); }

