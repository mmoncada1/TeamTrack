"""TeamTrack Jac application entry point."""
import "./assets/main.css";
import "./assets/crud.css";
import "./assets/parity.css";
import "./state/migrate-local-ids.js";
import from "./state/cloud.js" { AuthGate }
import from .state.AppState { AppStateProvider }
def:pub app(children: any) -> JsxElement {
    can with entry {
        raw = localStorage.getItem("teamtrack:app-settings"); theme = "light"; reduced = False;
        if raw { try { parsed = JSON.parse(raw) as dict[str, any]; theme = "dark" if parsed.get("theme") == "dark" else "light"; reduced = bool(parsed.get("reducedMotion", False)); } except Exception { theme = "light"; reduced = False; } }
        document.documentElement.dataset["theme"] = theme;
        document.documentElement.classList.toggle("reduce-motion", reduced);
    }
    return <AuthGate><AppStateProvider>{children}</AppStateProvider></AuthGate>;
}
