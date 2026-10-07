import "./settings.css";
import from "@jac/runtime" { useNavigate }
import from ..state.AppState { use_app_state }
import from ..domain.backup { validate_backup }

glob SETTINGS_KEY = "teamtrack:app-settings";
glob TEAMS_KEY = "teamtrack:jac:teams";
glob PLAYERS_KEY = "teamtrack:jac:players";
glob LINEUPS_KEY = "teamtrack:jac:lineups";
glob MATCHES_KEY = "teamtrack:jac:matches";
glob FOOTBALL_FORMATIONS_KEY = "teamtrack:jac:football-formations";
glob FOOTBALL_PLAYS_KEY = "teamtrack:jac:football-plays";
glob DRIVE_PLANS_KEY = "teamtrack:jac:drive-plans";
glob FOOTBALL_WHITEBOARDS_KEY = "teamtrack:jac:football-whiteboards";
glob ACTIVE_TEAM_KEY = "teamtrack:jac:active-team-id";
glob WHITEBOARD_PREFIX = "teamtrack:whiteboard:";
glob RESTORE_FLASH_KEY = "teamtrack:restore-message";

def load_settings() -> dict[str, any] {
    defaults: dict[str, any] = {"theme": "light", "alertSoundEnabled": False, "reducedMotion": False, "fieldLocked": False};
    raw = localStorage.getItem(SETTINGS_KEY);
    if not raw { return defaults; }
    try {
        parsed = JSON.parse(raw) as dict[str, any];
        if parsed {
            return {
                "theme": parsed["theme"] if "theme" in parsed and parsed["theme"] == "dark" else "light",
                "alertSoundEnabled": bool(parsed["alertSoundEnabled"]) if "alertSoundEnabled" in parsed else False,
                "reducedMotion": bool(parsed["reducedMotion"]) if "reducedMotion" in parsed else False,
                "fieldLocked": bool(parsed["fieldLocked"]) if "fieldLocked" in parsed else False
            };
        }
    } except Exception { return defaults; }
    return defaults;
}

def parse_storage(key: str, fallback: any) -> any {
    raw = localStorage.getItem(key);
    if not raw { return fallback; }
    try { return JSON.parse(raw); } except Exception { return fallback; }
}

def discover_whiteboards() -> dict[str, any] {
    boards: dict[str, any] = {};
    for index in range(localStorage.length) {
        key = localStorage.key(index);
        if key and key.startswith(WHITEBOARD_PREFIX) { boards[key] = parse_storage(key, {"strokes": [], "notes": []}); }
    }
    return boards;
}

def build_backup() -> dict[str, any] {
    return {
        "app": "TeamTrack Jac", "schemaVersion": 1, "exportedAt": new(Date).toISOString(),
        "data": {
            "teams": parse_storage(TEAMS_KEY, []), "players": parse_storage(PLAYERS_KEY, []),
            "lineups": parse_storage(LINEUPS_KEY, []), "matches": parse_storage(MATCHES_KEY, []),
            "footballFormations": parse_storage(FOOTBALL_FORMATIONS_KEY, []),
            "footballPlays": parse_storage(FOOTBALL_PLAYS_KEY, []),
            "drivePlans": parse_storage(DRIVE_PLANS_KEY, []),
            "footballWhiteboards": parse_storage(FOOTBALL_WHITEBOARDS_KEY, []),
            "activeTeamId": localStorage.getItem(ACTIVE_TEAM_KEY) or "",
            "appSettings": parse_storage(SETTINGS_KEY, load_settings()),
            "whiteboards": discover_whiteboards()
        }
    };
}

def convert_typescript_roster(source: any) -> dict[str, any] {
    if source.get("version") != 5 or not isinstance(source.get("teams"), list) or not isinstance(source.get("players"), list) {
        raise ValueError("Only TypeScript version 5 roster backups are supported.");
    }
    teams: list[dict[str, any]] = []; players: list[dict[str, any]] = []; team_ids: list[str] = []; player_ids: list[str] = [];
    for item in source["teams"] {
        if not item or not isinstance(item.get("id"), str) or not item["id"] or not isinstance(item.get("name"), str) or not item["name"].strip() or item["id"] in team_ids {
            raise ValueError("A team is missing its id or name, or has a duplicate id.");
        }
        sport = item.get("sport") or "soccer";
        if sport not in ["soccer", "football"] { raise ValueError("A team has an unsupported sport."); }
        team_ids.append(item["id"]);
        teams.append({"id": item["id"], "name": item["name"], "sport": sport, "coed": item.get("coed") or False,
            "min_girls_on_field": item.get("minGirlsOnField"), "photo_id": None,
            "created_at": item.get("createdAt") or 0, "updated_at": item.get("updatedAt") or 0});
    }
    if not teams { raise ValueError("The backup has no teams."); }
    for item in source["players"] {
        if not item or not isinstance(item.get("id"), str) or not item["id"] or item["id"] in player_ids or item.get("teamId") not in team_ids or not isinstance(item.get("name"), str) or not item["name"].strip() {
            raise ValueError("A player has an invalid id, name, or team.");
        }
        group = item.get("preferredGroup") or "MID";
        if group not in ["GK", "DEF", "MID", "FWD"] { raise ValueError("A player has an invalid position."); }
        groups = item.get("preferredGroups") if isinstance(item.get("preferredGroups"), list) else [group];
        player_ids.append(item["id"]);
        players.append({"id": item["id"], "team_id": item["teamId"], "name": item["name"], "preferred_group": group,
            "preferred_groups": groups, "availability": item.get("availability") or "active", "jersey_number": item.get("jerseyNumber"),
            "gender": item.get("gender"), "notes": item.get("notes"), "photo_id": None,
            "created_at": item.get("createdAt") or 0, "updated_at": item.get("updatedAt") or 0});
    }
    return {"app": "TeamTrack Jac", "schemaVersion": 1, "data": {"teams": teams, "players": players,
        "lineups": [], "matches": [], "footballFormations": [], "footballPlays": [], "drivePlans": [], "footballWhiteboards": [],
        "activeTeamId": teams[0]["id"], "appSettings": source.get("settings") or {}, "whiteboards": {}}};
}

def:pub SettingsPage() -> JsxPage {
    navigate = useNavigate(); state = use_app_state(); initial = load_settings(); flash = sessionStorage.getItem(RESTORE_FLASH_KEY) or "";
    if flash { sessionStorage.removeItem(RESTORE_FLASH_KEY); }
    has theme: str = initial["theme"];
    has alert_sound: bool = initial["alertSoundEnabled"];
    has reduced_motion: bool = initial["reducedMotion"];
    has field_locked: bool = initial["fieldLocked"];
    has saved: bool = False; has feedback: str = flash; has feedback_error: bool = False;
    has pending_backup: any = None; has pending_name: str = ""; has roster_only: bool = False;

    can with [theme, alert_sound, reduced_motion, field_locked] entry {
        value = {"theme": theme, "alertSoundEnabled": alert_sound, "reducedMotion": reduced_motion, "fieldLocked": field_locked};
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
        document.documentElement.dataset["theme"] = theme;
        document.documentElement.classList.toggle("reduce-motion", reduced_motion);
        saved = True;
    }

    def export_backup {
        content = JSON.stringify(build_backup(), None, 2); anchor: any = document.createElement("a");
        anchor.href = "data:application/json;charset=utf-8," + encodeURIComponent(content);
        anchor.download = "teamtrack-jac-backup.json"; anchor.click();
        feedback = "Backup exported successfully."; feedback_error = False;
    }

    async def choose_backup(event: any) -> None {
        pending_backup = None; pending_name = ""; roster_only = False; feedback = ""; feedback_error = False;
        if not event.target.files or event.target.files.length == 0 { return; }
        file: any = event.target.files[0]; event.target.value = "";
        try {
            content = await file.text(); parsed: any = JSON.parse(content);
            if parsed and "version" in parsed and "schemaVersion" not in parsed { parsed = convert_typescript_roster(parsed); roster_only = True; }
            errors = validate_backup(parsed);
            if errors { feedback = "Backup cannot be restored: " + " ".join(errors); feedback_error = True; return; }
            pending_backup = parsed; pending_name = file.name;
        } except Exception as error {
            feedback = "Backup could not be read: " + str(error); feedback_error = True;
        }
    }

    def restore_backup {
        if pending_backup is None { return; }
        if not window.confirm("Replace all TeamTrack Jac data on this device with " + pending_name + "?" + (" Only teams and players will be imported; matches, lineups, and photos in this file will be skipped." if roster_only else "") + " This cannot be undone.") { return; }
        data = pending_backup["data"];
        localStorage.setItem(TEAMS_KEY, JSON.stringify(data["teams"]));
        localStorage.setItem(PLAYERS_KEY, JSON.stringify(data["players"]));
        localStorage.setItem(LINEUPS_KEY, JSON.stringify(data["lineups"]));
        localStorage.setItem(MATCHES_KEY, JSON.stringify(data["matches"]));
        localStorage.setItem(FOOTBALL_FORMATIONS_KEY, JSON.stringify(data.get("footballFormations", [])));
        localStorage.setItem(FOOTBALL_PLAYS_KEY, JSON.stringify(data.get("footballPlays", [])));
        localStorage.setItem(DRIVE_PLANS_KEY, JSON.stringify(data.get("drivePlans", [])));
        localStorage.setItem(FOOTBALL_WHITEBOARDS_KEY, JSON.stringify(data.get("footballWhiteboards", [])));
        localStorage.setItem(ACTIVE_TEAM_KEY, data["activeTeamId"]);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(data["appSettings"]));
        whiteboard_keys: list[str] = [];
        for index in range(localStorage.length) { key = localStorage.key(index); if key and key.startswith(WHITEBOARD_PREFIX) { whiteboard_keys.append(key); } }
        for key in whiteboard_keys { localStorage.removeItem(key); }
        for (key, board) in data["whiteboards"].items() { localStorage.setItem(key, JSON.stringify(board)); }
        sessionStorage.setItem(RESTORE_FLASH_KEY, "Backup restored successfully."); window.location.reload();
    }
    def load_demo {
        count = state["loadDemoRoster"].call(None);
        feedback = "Loaded " + str(count) + " demo players." if count else "Demo players are already on this team.";
        feedback_error = False;
    }
    def reset_local_data {
        if not window.confirm("Delete all TeamTrack Jac teams, rosters, lineups, matches, whiteboards, and settings on this device? Export a backup first if you need one.") { return; }
        keys = [TEAMS_KEY, PLAYERS_KEY, LINEUPS_KEY, MATCHES_KEY, FOOTBALL_FORMATIONS_KEY, FOOTBALL_PLAYS_KEY, DRIVE_PLANS_KEY, FOOTBALL_WHITEBOARDS_KEY, ACTIVE_TEAM_KEY, SETTINGS_KEY];
        for index in range(localStorage.length) {
            key = localStorage.key(index);
            if key and key.startswith(WHITEBOARD_PREFIX) { keys.append(key); }
        }
        for key in keys { localStorage.removeItem(key); }
        sessionStorage.setItem(RESTORE_FLASH_KEY, "Local TeamTrack Jac data reset."); window.location.reload();
    }

    <section className="page app-settings-page">
        <div className="title-row"><h1>Settings</h1><button className="button ghost" onClick={lambda { navigate("/"); }}>Back to dashboard</button></div>
        {<p className={"error settings-feedback" if feedback_error else "success settings-feedback"} role={"alert" if feedback_error else "status"}>{feedback}</p> if feedback else (<p className="success settings-saved" role="status">Preferences saved.</p> if saved else None)}
        <section className="card settings-card"><h2>Appearance and match controls</h2>
            <label className="settings-toggle"><span><strong>Dark theme</strong></span><input type="checkbox" checked={theme == "dark"} onChange={lambda (e: ChangeEvent) { theme = "dark" if e.target.checked else "light"; }} /></label>
            <label className="settings-toggle"><span><strong>Reduce motion</strong></span><input type="checkbox" checked={reduced_motion} onChange={lambda (e: ChangeEvent) { reduced_motion = e.target.checked; }} /></label>
            <label className="settings-toggle"><span><strong>Lock field layout</strong></span><input type="checkbox" checked={field_locked} onChange={lambda (e: ChangeEvent) { field_locked = e.target.checked; }} /></label>
            <label className="settings-toggle"><span><strong>Play alert sounds</strong></span><input type="checkbox" checked={alert_sound} onChange={lambda (e: ChangeEvent) { alert_sound = e.target.checked; }} /></label>
        </section>
        <section className="card settings-card"><h2>Backup and restore</h2><p className="muted">Jac backups restore all Jac data. TypeScript version 5 backups can restore teams and players; matches, lineups, and photos are skipped.</p>
            <div className="backup-actions"><button className="button secondary" type="button" onClick={export_backup}>Export JSON backup</button><label className="button secondary file-button">Choose backup file<input type="file" accept="application/json,.json" onChange={choose_backup} /></label></div>
            {<div className="restore-confirm" role="dialog" aria-label="Confirm backup restore"><strong>Ready to restore {pending_name}</strong><p>{"This imports " + str(len(pending_backup["data"]["teams"])) + " teams and " + str(len(pending_backup["data"]["players"])) + " players. Match history, lineups, and photos in this file will be skipped. " if roster_only else ""}This replaces all TeamTrack Jac data on this device. Export your current data first if you may need it.</p><div><button className="button ghost" type="button" onClick={lambda { pending_backup = None; pending_name = ""; }}>Cancel</button><button className="button danger" type="button" onClick={restore_backup}>Replace local data</button></div></div> if pending_backup is not None else None}
        </section>
        <section className="card settings-card"><h2>Sample data and reset</h2><p className="muted">Add sample soccer players to the active team, or clear this browser's TeamTrack Jac data.</p><div className="backup-actions"><button className="button secondary" type="button" onClick={load_demo}>Load demo roster</button><button className="button danger" type="button" onClick={reset_local_data}>Reset local Jac data</button></div></section>
    </section>
}
