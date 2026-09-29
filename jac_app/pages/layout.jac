import from "@jac/runtime" { Link, Outlet, useLocation }
import from ..components.TeamSwitcher { TeamSwitcher }
def NavItem(path: str, label: str, current_path: str) -> JsxElement {
    active = current_path == path or (path != "/" and current_path.startswith(path));
    return <Link to={path} className={"nav-link active" if active else "nav-link"}>{label}</Link>;
}
def:pub AppShell() -> JsxLayout {
    location = useLocation();
    <div className="app-shell"><a href="#main-content" className="skip-link">Skip to main content</a>
        <header className="app-header"><nav className="nav" aria-label="Main navigation">
            <Link to="/" className="brand"><span aria-hidden={True}>⚽</span> TeamTrack</Link>
            {NavItem("/", "Dashboard", location.pathname)}{NavItem("/roster", "Roster", location.pathname)}
            {NavItem("/lineups", "Lineups", location.pathname)}{NavItem("/matches", "Matches", location.pathname)}
            {NavItem("/team/settings", "Team", location.pathname)}{NavItem("/whiteboard", "Whiteboard", location.pathname)}
            {NavItem("/settings", "Settings", location.pathname)}<TeamSwitcher />
        </nav></header><main id="main-content" className="main-content"><Outlet /></main>
    </div>
}

