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
def:pub create_id(prefix: str) -> str { browser: any = window; return str(browser.crypto.randomUUID()); }
def:pub save_teams(items: list[Team]) { localStorage.setItem(TEAMS_KEY, JSON.stringify(items)); }
def:pub load_teams() -> list[Team] {
    raw = localStorage.getItem(TEAMS_KEY); if raw {
        parsed = JSON.parse(raw) as list[Team];
        if parsed {
            explicit = JSON.parse(localStorage.getItem("teamtrack:jac:explicit-team-ids") or "[]") as list[str];
            if len(parsed) == 1 and parsed[0].name in ["New Team", "My Team"] and parsed[0].id not in explicit {
                id = parsed[0].id;
                linked = any([item.team_id == id for item in load_players()]) or any([item.team_id == id for item in load_lineups()]) or any([item.team_id == id for item in load_matches()]) or any([item.team_id == id for item in load_football_formations()]) or any([item.team_id == id for item in load_football_plays()]) or any([item.team_id == id for item in load_drive_plans()]) or any([item.team_id == id for item in load_football_whiteboards()]);
                if not linked { save_teams([]); return []; }
            }
            for team in parsed { if not team.sport { team.sport = "soccer"; } }
            return parsed;
        }
    }
    return [];
}
def:pub save_players(items: list[Player]) { localStorage.setItem(PLAYERS_KEY, JSON.stringify(items)); }
def:pub load_players() -> list[Player] { raw = localStorage.getItem(PLAYERS_KEY); return JSON.parse(raw) as list[Player] if raw else []; }
def:pub save_lineups(items: list[SavedLineup]) { localStorage.setItem(LINEUPS_KEY, JSON.stringify(items)); }
def:pub load_lineups() -> list[SavedLineup] { raw = localStorage.getItem(LINEUPS_KEY); return JSON.parse(raw) as list[SavedLineup] if raw else []; }
def:pub save_matches(items: list[Match]) { localStorage.setItem(MATCHES_KEY, JSON.stringify(items)); }
def:pub load_matches() -> list[Match] {
    raw = localStorage.getItem(MATCHES_KEY); items = JSON.parse(raw) as list[Match] if raw else [];
    for game in items {
        if not game.settings.minimum_playing_time_minutes { game.settings.minimum_playing_time_minutes = 10; }
    }
    return items;
}
def:pub save_football_formations(items: list[FootballFormation]) { localStorage.setItem(FOOTBALL_FORMATIONS_KEY, JSON.stringify(items)); }
def:pub load_football_formations() -> list[FootballFormation] { raw = localStorage.getItem(FOOTBALL_FORMATIONS_KEY); return JSON.parse(raw) as list[FootballFormation] if raw else []; }
def:pub save_football_plays(items: list[FootballPlay]) { localStorage.setItem(FOOTBALL_PLAYS_KEY, JSON.stringify(items)); }
def:pub load_football_plays() -> list[FootballPlay] { raw = localStorage.getItem(FOOTBALL_PLAYS_KEY); return JSON.parse(raw) as list[FootballPlay] if raw else []; }
def:pub save_drive_plans(items: list[DrivePlan]) { localStorage.setItem(DRIVE_PLANS_KEY, JSON.stringify(items)); }
def:pub load_drive_plans() -> list[DrivePlan] { raw = localStorage.getItem(DRIVE_PLANS_KEY); return JSON.parse(raw) as list[DrivePlan] if raw else []; }
def:pub save_football_whiteboards(items: list[FootballWhiteboard]) { localStorage.setItem(FOOTBALL_WHITEBOARDS_KEY, JSON.stringify(items)); }
def:pub load_football_whiteboards() -> list[FootballWhiteboard] { raw = localStorage.getItem(FOOTBALL_WHITEBOARDS_KEY); return JSON.parse(raw) as list[FootballWhiteboard] if raw else []; }
def:pub load_active_team_id(teams: list[Team]) -> str {
    saved = localStorage.getItem(ACTIVE_TEAM_KEY); if saved and any([team.id == saved for team in teams]) { return saved; } return teams[0].id if teams else "";
}
def:pub save_active_team_id(id: str) { localStorage.setItem(ACTIVE_TEAM_KEY, id); }
