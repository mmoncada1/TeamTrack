import "./settings.css";
import from "@jac/runtime" { useNavigate }

glob SETTINGS_KEY = "teamtrack:app-settings";
glob TEAMS_KEY = "teamtrack:jac:teams";
glob PLAYERS_KEY = "teamtrack:jac:players";
glob LINEUPS_KEY = "teamtrack:jac:lineups";
glob MATCHES_KEY = "teamtrack:jac:matches";
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
            "activeTeamId": localStorage.getItem(ACTIVE_TEAM_KEY) or "",
            "appSettings": parse_storage(SETTINGS_KEY, load_settings()),
            "whiteboards": discover_whiteboards()
        }
    };
}

def validate_backup(candidate: any) -> list[str] {
    errors: list[str] = [];
    if not isinstance(candidate, dict) { return ["The backup must contain a JSON object."]; }
    if "schemaVersion" not in candidate or candidate["schemaVersion"] != 1 { errors.append("Unsupported or missing backup schema version."); }
    if "data" not in candidate or not isinstance(candidate["data"], dict) { return errors + ["The backup is missing its data section."]; }
    data = candidate["data"];
    for key in ["teams", "players", "lineups", "matches"] {
        if key not in data or not isinstance(data[key], list) { errors.append("The " + key + " collection is missing or invalid."); }
    }
    if "teams" in data and isinstance(data["teams"], list) {
        if not data["teams"] { errors.append("The backup must contain at least one team."); }
        for team in data["teams"] {
            if not isinstance(team, dict) or "id" not in team or "name" not in team { errors.append("Every team needs an id and name."); break; }
        }
    }
    if "activeTeamId" not in data or not isinstance(data["activeTeamId"], str) { errors.append("The active team id is missing or invalid."); }
    elif "teams" in data and isinstance(data["teams"], list) and not any([isinstance(team, dict) and "id" in team and team["id"] == data["activeTeamId"] for team in data["teams"]]) { errors.append("The active team does not exist in the teams collection."); }
    if "appSettings" not in data or not isinstance(data["appSettings"], dict) { errors.append("App settings are missing or invalid."); }
    if "whiteboards" not in data or not isinstance(data["whiteboards"], dict) { errors.append("Whiteboard data is missing or invalid."); }
    elif any([not str(key).startswith(WHITEBOARD_PREFIX) for key in data["whiteboards"].keys()]) { errors.append("The backup contains an invalid whiteboard key."); }
    return errors;
}

def:pub SettingsPage() -> JsxPage {
    navigate = useNavigate(); initial = load_settings(); flash = sessionStorage.getItem(RESTORE_FLASH_KEY) or "";
    if flash { sessionStorage.removeItem(RESTORE_FLASH_KEY); }
    has theme: str = initial["theme"];
    has alert_sound: bool = initial["alertSoundEnabled"];
    has reduced_motion: bool = initial["reducedMotion"];
    has field_locked: bool = initial["fieldLocked"];
    has saved: bool = False; has feedback: str = flash; has feedback_error: bool = False;
    has pending_backup: any = None; has pending_name: str = "";

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
        pending_backup = None; pending_name = ""; feedback = ""; feedback_error = False;
        if not event.target.files or event.target.files.length == 0 { return; }
        file: any = event.target.files[0]; event.target.value = "";
        try {
            text = await file.text(); parsed: any = JSON.parse(text); errors = validate_backup(parsed);
            if errors { feedback = "Backup cannot be restored: " + " ".join(errors); feedback_error = True; return; }
            pending_backup = parsed; pending_name = file.name;
        } except Exception {
            feedback = "Backup cannot be restored: the selected file is not valid JSON."; feedback_error = True;
        }
    }

    def restore_backup {
        if pending_backup is None { return; }
        if not window.confirm("Replace all TeamTrack Jac data on this device with " + pending_name + "? This cannot be undone.") { return; }
        data = pending_backup["data"];
        localStorage.setItem(TEAMS_KEY, JSON.stringify(data["teams"]));
        localStorage.setItem(PLAYERS_KEY, JSON.stringify(data["players"]));
        localStorage.setItem(LINEUPS_KEY, JSON.stringify(data["lineups"]));
        localStorage.setItem(MATCHES_KEY, JSON.stringify(data["matches"]));
        localStorage.setItem(ACTIVE_TEAM_KEY, data["activeTeamId"]);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(data["appSettings"]));
        whiteboard_keys: list[str] = [];
        for index in range(localStorage.length) { key = localStorage.key(index); if key and key.startswith(WHITEBOARD_PREFIX) { whiteboard_keys.append(key); } }
        for key in whiteboard_keys { localStorage.removeItem(key); }
        for (key, board) in data["whiteboards"].items() { localStorage.setItem(key, JSON.stringify(board)); }
        sessionStorage.setItem(RESTORE_FLASH_KEY, "Backup restored successfully."); window.location.reload();
    }

    <section className="page app-settings-page">
        <div className="title-row"><div><h1>Settings</h1><p className="muted">Device preferences are saved automatically in this browser.</p></div><button className="button ghost" onClick={lambda { navigate("/"); }}>Back to dashboard</button></div>
        {<p className={"error settings-feedback" if feedback_error else "success settings-feedback"} role={"alert" if feedback_error else "status"}>{feedback}</p> if feedback else (<p className="success settings-saved" role="status">Preferences saved.</p> if saved else None)}
        <section className="card settings-card"><h2>Appearance and match controls</h2>
            <label className="settings-toggle"><span><strong>Dark theme</strong><small>Use a darker palette throughout TeamTrack.</small></span><input type="checkbox" checked={theme == "dark"} onChange={lambda (e: ChangeEvent) { theme = "dark" if e.target.checked else "light"; }} /></label>
            <label className="settings-toggle"><span><strong>Reduce motion</strong><small>Minimize interface animations and transitions.</small></span><input type="checkbox" checked={reduced_motion} onChange={lambda (e: ChangeEvent) { reduced_motion = e.target.checked; }} /></label>
            <label className="settings-toggle"><span><strong>Lock field layout</strong><small>Prevent accidental player movement during matches.</small></span><input type="checkbox" checked={field_locked} onChange={lambda (e: ChangeEvent) { field_locked = e.target.checked; }} /></label>
            <label className="settings-toggle"><span><strong>Play alert sounds</strong><small>Play a sound when a new substitution alert appears.</small></span><input type="checkbox" checked={alert_sound} onChange={lambda (e: ChangeEvent) { alert_sound = e.target.checked; }} /></label>
        </section>
        <section className="card settings-card"><h2>Backup and restore</h2><p className="muted">Export teams, players, lineups, matches, active-team selection, preferences, and saved whiteboards to one JSON file.</p>
            <div className="backup-actions"><button className="button secondary" type="button" onClick={export_backup}>Export JSON backup</button><label className="button secondary file-button">Choose backup file<input type="file" accept="application/json,.json" onChange={choose_backup} /></label></div>
            {<div className="restore-confirm" role="dialog" aria-label="Confirm backup restore"><strong>Ready to restore {pending_name}</strong><p>This replaces all TeamTrack Jac data on this device. Export your current data first if you may need it.</p><div><button className="button ghost" type="button" onClick={lambda { pending_backup = None; pending_name = ""; }}>Cancel</button><button className="button danger" type="button" onClick={restore_backup}>Replace local data</button></div></div> if pending_backup is not None else None}
        </section>
    </section>
}
