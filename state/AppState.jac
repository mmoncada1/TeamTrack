"""Reactive application state shared by all TeamTrack routes."""
import from "react" { createContext, useContext }
import from ..domain.models { Team, Player, SavedLineup, Match, MatchSettings, ThresholdSetting }
import from ..domain.matches { create_draft_match }
import from ..domain.live_match { start_match as start_match_action }
import from ..domain.roster { clamp_min_girls, normalize_position_groups, sort_players, validate_player }
import from football.models { Formation as FootballFormation, Play as FootballPlay, DrivePlan, Whiteboard as FootballWhiteboard }
import from football.validation { formation_errors, play_errors, drive_errors }
import from .storage { create_id, load_active_team_id, load_players, load_teams, load_lineups, load_matches,
    save_active_team_id, save_players, save_teams, save_lineups, save_matches,
    load_football_formations, save_football_formations, load_football_plays, save_football_plays,
    load_drive_plans, save_drive_plans, load_football_whiteboards, save_football_whiteboards }
glob AppStateContext = createContext(None);
def active_team(teams: list[Team], active_id: str) -> Team | None { for team in teams { if team.id == active_id { return team; } } return None; }
def team_sort_key(team: Team) -> str { return team.name.lower(); }
def lineup_sort_key(lineup: SavedLineup) -> str { return lineup.name.lower(); }
def:pub AppStateProvider(children: any = None) -> JsxElement {
    has teams: list[Team] = load_teams(); has players: list[Player] = load_players(); has lineups: list[SavedLineup] = load_lineups();
    has matches: list[Match] = load_matches(); has active_team_id: str = load_active_team_id(teams);
    has football_formations: list[FootballFormation] = load_football_formations();
    has football_plays: list[FootballPlay] = load_football_plays();
    has drive_plans: list[DrivePlan] = load_drive_plans();
    has football_whiteboards: list[FootballWhiteboard] = load_football_whiteboards();
    can with [teams] entry { save_teams(teams); } can with [players] entry { save_players(players); }
    can with [lineups] entry { save_lineups(lineups); } can with [matches] entry { save_matches(matches); }
    can with [active_team_id] entry { save_active_team_id(active_team_id); }
    can with [football_formations] entry { save_football_formations(football_formations); }
    can with [football_plays] entry { save_football_plays(football_plays); }
    can with [drive_plans] entry { save_drive_plans(drive_plans); }
    can with [football_whiteboards] entry { save_football_whiteboards(football_whiteboards); }
    def set_active_team(id: str) { if any([team.id == id for team in teams]) { active_team_id = id; } }
    def create_team(name: str, coed: bool, min_girls: int, sport: str = "soccer") -> str {
        trimmed = name.strip(); if not trimmed { return "Team name is required."; }
        if sport not in ["soccer", "football"] { return "Choose soccer or football."; }
        if any([team.name.lower() == trimmed.lower() for team in teams]) { return "A team with that name already exists."; }
        now = int(Date.now()); team = Team(id=create_id("team"), name=trimmed, sport=sport, coed=coed if sport == "soccer" else False, min_girls_on_field=clamp_min_girls(min_girls) if sport == "soccer" else None, created_at=now, updated_at=now);
        teams = sorted(teams + [team], key=team_sort_key); active_team_id = team.id; return "";
    }
    def update_team(id: str, name: str, coed: bool, min_girls: int, photo_data: str | None = None) -> str {
        trimmed = name.strip(); if not trimmed { return "Team name is required."; }
        if any([team.id != id and team.name.lower() == trimmed.lower() for team in teams]) { return "A team with that name already exists."; }
        found = False; updated: list[Team] = [];
        for team in teams {
            if team.id == id { found = True; updated.append(Team(id=team.id, name=trimmed, sport=team.sport if team.sport else "soccer", coed=coed if team.sport != "football" else False, min_girls_on_field=clamp_min_girls(min_girls) if team.sport != "football" else None, photo_id=(photo_data if photo_data else None) if photo_data is not None else team.photo_id, created_at=team.created_at, updated_at=int(Date.now()))); }
            else { updated.append(team); }
        }
        if not found { return "Team not found."; } teams = sorted(updated, key=team_sort_key); return "";
    }
    def delete_team(id: str) -> str {
        if len(teams) <= 1 { return "Keep at least one team."; }
        remaining = [team for team in teams if team.id != id]; if len(remaining) == len(teams) { return "Team not found."; }
        teams = remaining; players = [p for p in players if p.team_id != id]; lineups = [item for item in lineups if item.team_id != id]; matches = [item for item in matches if item.team_id != id];
        football_formations = [item for item in football_formations if item.team_id != id];
        football_plays = [item for item in football_plays if item.team_id != id];
        drive_plans = [item for item in drive_plans if item.team_id != id];
        football_whiteboards = [item for item in football_whiteboards if item.team_id != id];
        if active_team_id == id { active_team_id = remaining[0].id; } return "";
    }
    def save_player(id: str, name: str, jersey_number: int | None, groups: list[str], gender: str | None, notes: str, availability: str, photo_data: str | None = None) -> list[str] {
        team = active_team(teams, active_team_id); if team is None { return ["Choose a team before adding a player."]; }
        if id and not any([player.id == id and player.team_id == team.id for player in players]) { return ["Player is not on this team."]; }
        errors = validate_player(name, jersey_number, groups, gender, team.coed, [p for p in players if p.team_id == team.id], id if id else None);
        if errors { return [error.message for error in errors]; }
        normalized = normalize_position_groups(groups); now = int(Date.now()); existing: Player | None = None;
        for player in players { if player.id == id { existing = player; break; } }
        saved = Player(id=id if id else create_id("player"), team_id=team.id, name=name.strip(), jersey_number=jersey_number,
            preferred_group=normalized[0], preferred_groups=normalized, gender=gender if gender in ["girl", "boy"] else None,
            notes=notes.strip() if notes.strip() else None, availability=availability, photo_id=(photo_data if photo_data else None) if photo_data is not None else (existing.photo_id if existing is not None else None),
            created_at=existing.created_at if existing is not None else now, updated_at=now);
        players = sort_players([player for player in players if player.id != saved.id] + [saved]); return [];
    }
    def delete_player(id: str) {
        if not any([player.id == id and player.team_id == active_team_id for player in players]) { return; }
        players = [player for player in players if player.id != id];
        next_formations: list[FootballFormation] = [];
        for item in football_formations {
            if item.team_id == active_team_id {
                copy = structuredClone(item);
                for slot in copy.players { if slot.roster_player_id == id { slot.roster_player_id = None; } }
                next_formations.append(copy);
            } else { next_formations.append(item); }
        }
        football_formations = next_formations;
        next_plays: list[FootballPlay] = [];
        for item in football_plays {
            if item.team_id == active_team_id {
                play_copy = structuredClone(item);
                for slot in play_copy.players { if slot.roster_player_id == id { slot.roster_player_id = None; } }
                next_plays.append(play_copy);
            } else { next_plays.append(item); }
        }
        football_plays = next_plays;
    }
    def load_demo_roster() -> int {
        team = active_team(teams, active_team_id); if team is None { return 0; }
        samples = [("Alex Rivera", "GK"), ("Jordan Lee", "DEF"), ("Sam Okafor", "DEF"),
            ("Casey Nguyen", "DEF"), ("Maya Torres", "MID"), ("Priya Shah", "MID"),
            ("Liam Fischer", "MID"), ("Noah Kim", "FWD"), ("Ella Martin", "FWD"),
            ("Diego Santos", "DEF"), ("Grace Wallace", "MID"), ("Theo Brandt", "FWD")];
        existing = [player for player in players if player.team_id == team.id];
        used_numbers = [player.jersey_number for player in existing if player.jersey_number is not None];
        existing_names = [player.name.lower() for player in existing]; new_players: list[Player] = [];
        next_number = 1; now = int(Date.now());
        for (name, group) in samples {
            if name.lower() in existing_names { continue; }
            while next_number in used_numbers { next_number += 1; }
            new_players.append(Player(id=create_id("player") + "-" + str(next_number), team_id=team.id,
                name=name, jersey_number=next_number, preferred_group=group, preferred_groups=[group],
                availability="active", created_at=now, updated_at=now));
            used_numbers.append(next_number); next_number += 1;
        }
        if new_players { players = sort_players(players + new_players); }
        return len(new_players);
    }
    def save_lineup(id: str, name: str, format: str, formation_id: str, assignments: dict[str, str]) -> str {
        team = active_team(teams, active_team_id); if team is None { return "Choose a team before saving a lineup."; }
        if team.sport == "football" { return "Saved soccer lineups are only available to soccer teams."; }
        trimmed = name.strip(); if not trimmed { return "Give the lineup a name."; }
        if any([item.id != id and item.team_id == team.id and item.name.lower() == trimmed.lower() for item in lineups]) { return "This team already has a lineup with that name."; }
        existing: SavedLineup | None = None; for item in lineups { if item.id == id { existing = item; break; } }
        now = int(Date.now()); saved = SavedLineup(id=id if id else create_id("lineup"), team_id=team.id, name=trimmed, format=format,
            formation_id=formation_id, assignments=assignments, created_at=existing.created_at if existing is not None else now, updated_at=now);
        lineups = sorted([item for item in lineups if item.id != saved.id] + [saved], key=lineup_sort_key); return "";
    }
    def delete_lineup(id: str) { lineups = [item for item in lineups if item.id != id]; }
    def create_match_draft(date: str) -> str {
        team = active_team(teams, active_team_id); if team is None { return ""; }
        if team.sport == "football" { return ""; }
        roster_ids = [player.id for player in players if player.team_id == team.id and player.availability == "active"];
        draft = create_draft_match(create_id("match"), team.id, team.name, date, roster_ids, int(Date.now()));
        matches = [draft] + matches; return draft.id;
    }
    def save_match_setup(id: str, team_name: str, opponent_name: str, date: str, kickoff_time: str, title: str,
        format: str, formation_id: str, half_length: int, halves: int, thresholds: dict[str, ThresholdSetting],
        goalkeeper_rotation: bool, alert_sound: bool, roster_ids: list[str], unavailable_ids: list[str], assignments: dict[str, str], start_now: bool = False) -> str {
        existing: Match | None = None; for item in matches { if item.id == id { existing = item; break; } }
        if existing is None { return "Match draft not found."; }
        if any([team.id == existing.team_id and team.sport == "football" for team in teams]) { return "Soccer match setup requires a soccer team."; }
        updated = Match(id=existing.id, team_id=existing.team_id, team_name=team_name, opponent_name=opponent_name, date=date,
            kickoff_time=kickoff_time if kickoff_time else None, title=title if title else None,
            settings=MatchSettings(format=format, formation_id=formation_id, half_length_minutes=half_length, number_of_halves=halves,
                thresholds=thresholds, goalkeeper_rotation_enabled=goalkeeper_rotation, alert_sound_enabled=alert_sound),
            roster_player_ids=roster_ids, unavailable_player_ids=unavailable_ids, pending_assignments=assignments,
            pending_formation_id=formation_id, events=existing.events, active_alerts=existing.active_alerts,
            created_at=existing.created_at, updated_at=int(Date.now()));
        if start_now { updated = start_match_action(updated, int(Date.now())); }
        matches = [updated if item.id == id else item for item in matches]; return "";
    }
    def delete_match(id: str) { matches = [item for item in matches if item.id != id]; }
    def replace_match(next_game: Match) -> str {
        if not any([item.id == next_game.id for item in matches]) { return "Match not found."; }
        matches = [next_game if item.id == next_game.id else item for item in matches]; return "";
    }
    def football_team_exists(id: str) -> bool {
        return any([team.id == id and team.sport == "football" for team in teams]);
    }
    def save_football_formation(item: FootballFormation) -> str {
        if item.team_id != active_team_id or not football_team_exists(item.team_id) { return "Choose a football team."; }
        errors = formation_errors(item); if errors { return errors[0]; }
        if any([slot.roster_player_id and not any([player.id == slot.roster_player_id and player.team_id == item.team_id for player in players]) for slot in item.players]) { return "A player assignment belongs to another team or no longer exists."; }
        if any([existing.id == item.id and existing.team_id != item.team_id for existing in football_formations]) { return "Formation belongs to another team."; }
        football_formations = [existing for existing in football_formations if existing.id != item.id] + [item]; return "";
    }
    def delete_football_formation(id: str) {
        football_formations = [item for item in football_formations if item.id != id or item.team_id != active_team_id];
    }
    def save_football_play(item: FootballPlay) -> str {
        if item.team_id != active_team_id or not football_team_exists(item.team_id) { return "Choose a football team."; }
        errors = play_errors(item); if errors { return errors[0]; }
        if any([slot.roster_player_id and not any([player.id == slot.roster_player_id and player.team_id == item.team_id for player in players]) for slot in item.players]) { return "A player assignment belongs to another team or no longer exists."; }
        if any([existing.id == item.id and existing.team_id != item.team_id for existing in football_plays]) { return "Play belongs to another team."; }
        football_plays = [existing for existing in football_plays if existing.id != item.id] + [item]; return "";
    }
    def delete_football_play(id: str) {
        if not any([item.id == id and item.team_id == active_team_id for item in football_plays]) { return; }
        football_plays = [item for item in football_plays if item.id != id or item.team_id != active_team_id];
        updated: list[DrivePlan] = [];
        for plan in drive_plans {
            if plan.team_id == active_team_id {
                updated.append(DrivePlan(id=plan.id, team_id=plan.team_id, name=plan.name,
                    entries=[call for call in plan.entries if call.play_id != id],
                    created_at=plan.created_at, updated_at=int(Date.now())));
            } else { updated.append(plan); }
        }
        drive_plans = updated;
    }
    def save_drive_plan(item: DrivePlan) -> str {
        if item.team_id != active_team_id or not football_team_exists(item.team_id) { return "Choose a football team."; }
        play_ids = [play.id for play in football_plays if play.team_id == item.team_id];
        errors = drive_errors(item, play_ids); if errors { return errors[0]; }
        if any([existing.id == item.id and existing.team_id != item.team_id for existing in drive_plans]) { return "Drive plan belongs to another team."; }
        drive_plans = [existing for existing in drive_plans if existing.id != item.id] + [item]; return "";
    }
    def delete_drive_plan(id: str) { drive_plans = [item for item in drive_plans if item.id != id or item.team_id != active_team_id]; }
    def save_football_whiteboard(item: FootballWhiteboard) -> str {
        if item.team_id != active_team_id or not football_team_exists(item.team_id) { return "Choose a football team."; }
        football_whiteboards = [existing for existing in football_whiteboards if existing.team_id != item.team_id] + [item]; return "";
    }
    value = {"teams": teams, "players": players, "lineups": lineups, "matches": matches,
        "footballFormations": football_formations, "footballPlays": football_plays,
        "drivePlans": drive_plans, "footballWhiteboards": football_whiteboards, "activeTeamId": active_team_id,
        "setActiveTeam": set_active_team, "createTeam": create_team, "updateTeam": update_team, "deleteTeam": delete_team,
        "savePlayer": save_player, "deletePlayer": delete_player, "loadDemoRoster": load_demo_roster, "saveLineup": save_lineup, "deleteLineup": delete_lineup,
        "createMatchDraft": create_match_draft, "saveMatchSetup": save_match_setup, "deleteMatch": delete_match,
        "replaceMatch": replace_match, "saveFootballFormation": save_football_formation,
        "deleteFootballFormation": delete_football_formation, "saveFootballPlay": save_football_play,
        "deleteFootballPlay": delete_football_play, "saveDrivePlan": save_drive_plan,
        "deleteDrivePlan": delete_drive_plan, "saveFootballWhiteboard": save_football_whiteboard};
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
def:pub use_app_state() -> any { return useContext(AppStateContext); }
