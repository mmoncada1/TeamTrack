"""TeamTrack Jac application entry point."""
import "./assets/main.css";
import "./assets/crud.css";
import "./assets/parity.css";
import "./assets/welcome.css";
import "./state/migrate-local-ids.js";
import from "./state/cloud.js" { AuthGate }
import from .state.AppState { AppStateProvider }
def:pub app(children: any) -> JsxElement {
    can with entry {
        raw = localStorage.getItem("teamtrack:app-settings"); reduced = False;
        if raw { try { parsed = JSON.parse(raw) as dict[str, any]; reduced = bool(parsed.get("reducedMotion", False)); } except Exception { reduced = False; } }
        document.documentElement.dataset["theme"] = "dark";
        document.documentElement.classList.toggle("reduce-motion", reduced);
    }
    return <AuthGate><AppStateProvider>{children}</AppStateProvider></AuthGate>;
}
