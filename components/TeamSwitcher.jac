import from ..state.AppState { use_app_state }
import from "../state/cloud.js" { SignOutButton }
def:pub TeamSwitcher() -> JsxElement {
    state = use_app_state(); has creating: bool = False; has name: str = ""; has sport: str = "soccer"; has coed: bool = False; has min_girls: str = "2"; has error: str = "";
    def open_create { name = ""; sport = "soccer"; coed = False; min_girls = "2"; error = ""; creating = True; }
    def submit_create { result = state["createTeam"].call(None, name, coed, int(min_girls) if min_girls else 2, sport); if result { error = result; } else { creating = False; } }
    active_name = "";
    for team in state["teams"] { if team.id == state["activeTeamId"] { active_name = team.name; break; } }
    name_parts = active_name.strip().split();
    avatar_initials = ((name_parts[0][:2] if len(name_parts) == 1 else name_parts[0][:1] + name_parts[1][:1]).upper()) if name_parts else "?";
    <div className="team-switcher"><span className="team-switcher-avatar" aria-hidden={True}>{avatar_initials}</span><label htmlFor="active-team" className="sr-only">Active team</label>
        <select id="active-team" value={state["activeTeamId"]} onChange={lambda (e: ChangeEvent) { state["setActiveTeam"].call(None, e.target.value); }}>{[<option key={team.id} value={team.id}>{team.name}</option> for team in state["teams"]]}</select>
        <button type="button" className="button secondary small" onClick={open_create}>New team</button><SignOutButton />
        {<div className="modal-backdrop" role="presentation" onClick={lambda { creating = False; }}><section className="modal" role="dialog" aria-modal={True} aria-labelledby="new-team-title" onClick={lambda (e: MouseEvent) { e.stopPropagation(); }}>
            <h2 id="new-team-title">New team</h2><p>Each team has its own roster and matches.</p><label htmlFor="new-team-name">Team name</label><input id="new-team-name" className="input" value={name} onChange={lambda (e: ChangeEvent) { name = e.target.value; }} />
            <label htmlFor="new-team-sport">Sport</label><select id="new-team-sport" className="input" value={sport} onChange={lambda (e: ChangeEvent) { sport = e.target.value; }}><option value="soccer">Soccer</option><option value="football">Football</option></select>
            {<label className="check-row"><input type="checkbox" checked={coed} onChange={lambda (e: ChangeEvent) { coed = e.target.checked; }} /> Co-ed team</label> if sport == "soccer" else None}
            {<div><label htmlFor="new-team-min">Girls required on the field</label><input id="new-team-min" className="input short-input" type="number" min="1" max="11" value={min_girls} onChange={lambda (e: ChangeEvent) { min_girls = e.target.value; }} /></div> if sport == "soccer" and coed else None}
            {<p className="error" role="alert">{error}</p> if error else None}<div className="actions"><button className="button ghost" type="button" onClick={lambda { creating = False; }}>Cancel</button><button className="button primary" type="button" onClick={submit_create}>Create team</button></div>
        </section></div> if creating else None}
    </div>
}
