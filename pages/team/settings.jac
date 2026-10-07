import from "@jac/runtime" { useNavigate }
import from ...domain.roster { clamp_min_girls }
import from ...state.AppState { use_app_state }
import from "../../state/cloud.js" { saveTeamPhoto, flushTeamSettings }
def:pub TeamSettingsPage() -> JsxPage {
    state = use_app_state(); navigate = useNavigate(); active = None;
    for item in state["teams"] { if item.id == state["activeTeamId"] { active = item; break; } }
    has name: str = ""; has coed: bool = False; has min_girls: str = "2"; has photo_data: str = ""; has error: str = ""; has saved: bool = False; has saving: bool = False;
    active_id = active.id if active else "";
    can with [active_id] entry {
        if active { name = active.name; coed = active.coed; min_girls = str(clamp_min_girls(active.min_girls_on_field)); photo_data = active.photo_id or ""; error = ""; saved = False; }
    }
    def choose_photo(e: any) {
        file = e.target.files[0] if e.target.files and len(e.target.files) else None; if not file { return; }
        if file.size > 2500000 { error = "Choose an image smaller than 2.5 MB."; return; }
        browser: any = window; reader_class: any = browser["FileReader"]; reader: any = new(reader_class); reader.onload = lambda { photo_data = str(reader.result); error = ""; saved = False; }; reader.readAsDataURL(file);
    }
    async def save {
        if not active or saving { return; }
        saving = True; error = ""; saved = False;
        try {
            photo = await saveTeamPhoto(photo_data, active.id) if photo_data.startswith("data:image/") else photo_data;
            result = state["updateTeam"].call(None, active.id, name, coed, int(min_girls) if min_girls else 2, photo);
            if result { error = result; }
            else {
                photo_data = photo;
                await flushTeamSettings(active.id, photo, name, active.updated_at);
                saved = True;
            }
        } except Exception as problem { error = "Team settings could not be saved to Supabase: " + str(problem); }
        saving = False;
    }
    def remove {
        if not active { return; }
        if not window.confirm("Delete " + active.name + " and its roster from this device?") { return; }
        result = state["deleteTeam"].call(None, active.id); if result { error = result; } else { navigate("/"); }
    }
    if not active { return <section className="page narrow-page"><p>Loading team…</p></section>; }
    <section className="page settings-page"><div className="title-row"><h1>Team settings</h1><button className="button ghost" onClick={lambda { navigate("/"); }}>Back to dashboard</button></div>
        <p className="muted">{("Football" if active.sport == "football" else "Soccer")} team · Sport is fixed after creation. Players live in the roster.</p>
        <div className="card form-stack"><label htmlFor="team-name">Team name</label><input id="team-name" className="input" value={name} onChange={lambda (e: ChangeEvent) { name = e.target.value; saved = False; }} />
            <div className="photo-control"><div className="team-avatar photo-preview">{<img src={photo_data} alt={"Photo of " + (name or active.name)} /> if photo_data else (name.strip()[:2].upper() if name.strip() else "?")}</div><div><label htmlFor="team-photo">Team photo or crest</label><input id="team-photo" className="input file-input" type="file" accept="image/*" onChange={choose_photo} />{<button className="button ghost small" type="button" onClick={lambda { photo_data = ""; saved = False; }}>Remove photo</button> if photo_data else None}<p className="muted small-text">Saved to Supabase with your team for access on your devices.</p></div></div></div>
        {<div className="card form-stack"><h2>Co-ed rules</h2><label className="check-row"><input type="checkbox" checked={coed} onChange={lambda (e: ChangeEvent) { coed = e.target.checked; saved = False; }} /> This is a co-ed team</label>
            {<div><label htmlFor="team-min-girls">Girls required on the field</label><input id="team-min-girls" type="number" min="1" max="11" className="input short-input" value={min_girls} onChange={lambda (e: ChangeEvent) { min_girls = e.target.value; saved = False; }} /><p className="muted small-text">Each player needs a gender so live matches can enforce this rule.</p></div> if coed else None}</div> if active.sport != "football" else None}
        {<p className="error" role="alert">{error}</p> if error else None}{<p className="success" role="status">Team settings saved.</p> if saved else None}
        <div className="actions"><button className="button primary" type="button" disabled={saving} onClick={save}>{"Saving…" if saving else "Save team settings"}</button></div>
        <div className="danger-card"><h2>Delete this team</h2><p className="muted">Removes this team's roster, photos, lineups, matches, formations, plays, drive plans, and football whiteboard.</p><button className="button danger" type="button" disabled={len(state["teams"]) <= 1} onClick={remove}>Delete team</button>{<p className="muted small-text">You need at least one team.</p> if len(state["teams"]) <= 1 else None}</div>
    </section>
}
