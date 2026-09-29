"""Reactive application state shared by all TeamTrack routes."""
import from "react" { createContext, useContext }
import from ..domain.models { Team, Player, SavedLineup }
import from ..domain.roster { clamp_min_girls, normalize_position_groups, sort_players, validate_player }
import from .storage { create_id, load_active_team_id, load_players, load_teams, load_lineups,
    save_active_team_id, save_players, save_teams, save_lineups }
glob AppStateContext = createContext(None);
def active_team(teams: list[Team], active_id: str) -> Team | None { for team in teams { if team.id == active_id { return team; } } return None; }
def team_sort_key(team: Team) -> str { return team.name.lower(); }
def lineup_sort_key(lineup: SavedLineup) -> str { return lineup.name.lower(); }
def:pub AppStateProvider(children: any = None) -> JsxElement {
    has teams: list[Team] = load_teams(); has players: list[Player] = load_players(); has lineups: list[SavedLineup] = load_lineups();
    has active_team_id: str = load_active_team_id(teams);
    can with [teams] entry { save_teams(teams); } can with [players] entry { save_players(players); }
    can with [lineups] entry { save_lineups(lineups); } can with [active_team_id] entry { save_active_team_id(active_team_id); }
    def set_active_team(id: str) { if any([team.id == id for team in teams]) { active_team_id = id; } }
    def create_team(name: str, coed: bool, min_girls: int) -> str {
        trimmed = name.strip(); if not trimmed { return "Team name is required."; }
        if any([team.name.lower() == trimmed.lower() for team in teams]) { return "A team with that name already exists."; }
        now = int(Date.now()); team = Team(id=create_id("team"), name=trimmed, coed=coed, min_girls_on_field=clamp_min_girls(min_girls), created_at=now, updated_at=now);
        teams = sorted(teams + [team], key=team_sort_key); active_team_id = team.id; return "";
    }
    def update_team(id: str, name: str, coed: bool, min_girls: int) -> str {
        trimmed = name.strip(); if not trimmed { return "Team name is required."; }
        if any([team.id != id and team.name.lower() == trimmed.lower() for team in teams]) { return "A team with that name already exists."; }
        found = False; updated: list[Team] = [];
        for team in teams {
            if team.id == id { found = True; updated.append(Team(id=team.id, name=trimmed, coed=coed, min_girls_on_field=clamp_min_girls(min_girls), photo_id=team.photo_id, created_at=team.created_at, updated_at=int(Date.now()))); }
            else { updated.append(team); }
        }
        if not found { return "Team not found."; } teams = sorted(updated, key=team_sort_key); return "";
    }
    def delete_team(id: str) -> str {
        if len(teams) <= 1 { return "Keep at least one team."; }
        remaining = [team for team in teams if team.id != id]; if len(remaining) == len(teams) { return "Team not found."; }
        teams = remaining; players = [player for player in players if player.team_id != id]; lineups = [lineup for lineup in lineups if lineup.team_id != id];
        if active_team_id == id { active_team_id = remaining[0].id; } return "";
    }
    def save_player(id: str, name: str, jersey_number: int | None, groups: list[str], gender: str | None, notes: str, availability: str) -> list[str] {
        team = active_team(teams, active_team_id); if team is None { return ["Choose a team before adding a player."]; }
        errors = validate_player(name, jersey_number, groups, gender, team.coed, [p for p in players if p.team_id == team.id], id if id else None);
        if errors { return [error.message for error in errors]; }
        normalized = normalize_position_groups(groups); now = int(Date.now()); existing: Player | None = None;
        for player in players { if player.id == id { existing = player; break; } }
        saved = Player(id=id if id else create_id("player"), team_id=team.id, name=name.strip(), jersey_number=jersey_number,
            preferred_group=normalized[0], preferred_groups=normalized, gender=gender if gender in ["girl", "boy"] else None,
            notes=notes.strip() if notes.strip() else None, availability=availability, photo_id=existing.photo_id if existing is not None else None,
            created_at=existing.created_at if existing is not None else now, updated_at=now);
        players = sort_players([player for player in players if player.id != saved.id] + [saved]); return [];
    }
    def delete_player(id: str) { players = [player for player in players if player.id != id]; }
    def save_lineup(id: str, name: str, format: str, formation_id: str, assignments: dict[str, str]) -> str {
        team = active_team(teams, active_team_id); if team is None { return "Choose a team before saving a lineup."; }
        trimmed = name.strip(); if not trimmed { return "Give the lineup a name."; }
        if any([item.id != id and item.team_id == team.id and item.name.lower() == trimmed.lower() for item in lineups]) { return "This team already has a lineup with that name."; }
        existing: SavedLineup | None = None; for item in lineups { if item.id == id { existing = item; break; } }
        now = int(Date.now()); saved = SavedLineup(id=id if id else create_id("lineup"), team_id=team.id, name=trimmed, format=format,
            formation_id=formation_id, assignments=assignments, created_at=existing.created_at if existing is not None else now, updated_at=now);
        lineups = sorted([item for item in lineups if item.id != saved.id] + [saved], key=lineup_sort_key); return "";
    }
    def delete_lineup(id: str) { lineups = [item for item in lineups if item.id != id]; }
    value = {"teams": teams, "players": players, "lineups": lineups, "activeTeamId": active_team_id, "setActiveTeam": set_active_team,
        "createTeam": create_team, "updateTeam": update_team, "deleteTeam": delete_team, "savePlayer": save_player,
        "deletePlayer": delete_player, "saveLineup": save_lineup, "deleteLineup": delete_lineup};
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
def:pub use_app_state() -> any { return useContext(AppStateContext); }

