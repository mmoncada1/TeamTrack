import from "@jac/runtime" { Link, Navigate, Outlet, useLocation }
import from ..components.TeamSwitcher { TeamSwitcher }
import from ..state.AppState { use_app_state }
def NavItem(path: str, label: str, current_path: str) -> JsxElement {
    active = current_path == path or (path != "/" and current_path.startswith(path));
    return <Link to={path} className={"nav-link active" if active else "nav-link"}>{label}</Link>;
}
def:pub AppShell() -> JsxLayout {
    location = useLocation(); state = use_app_state(); active = None;
    for team in state["teams"] { if team.id == state["activeTeamId"] { active = team; break; } }
    football = active is not None and active.sport == "football";
    <div className="app-shell"><a href="#main-content" className="skip-link">Skip to main content</a>
        <header className="app-header"><nav className="nav" aria-label="Main navigation">
            <Link to="/" className="brand"><span className="brand-mark" aria-hidden={True}></span> TeamTrack</Link>
            {NavItem("/", "Dashboard", location.pathname)}{NavItem("/roster", "Roster", location.pathname)}
            {<>{NavItem("/football/formations", "Formations", location.pathname)}{NavItem("/football/playbook", "Playbook", location.pathname)}{NavItem("/football/drives", "Drive plans", location.pathname)}</> if football else <>{NavItem("/lineups", "Lineups", location.pathname)}{NavItem("/matches", "Matches", location.pathname)}</>}
            {NavItem("/team/settings", "Team", location.pathname)}{NavItem("/whiteboard", "Whiteboard", location.pathname)}
            {NavItem("/settings", "Settings", location.pathname)}<TeamSwitcher />
        </nav></header><main id="main-content" className="main-content">{<Navigate to="/" replace={True} /> if (location.pathname.startswith("/football/") and not football) or (football and (location.pathname.startswith("/lineups") or location.pathname.startswith("/matches") or location.pathname.startswith("/match/"))) else <Outlet />}</main>
    </div>
}
