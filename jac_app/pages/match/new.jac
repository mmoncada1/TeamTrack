import from "@jac/runtime" { useNavigate }
import from ...state.AppState { use_app_state }
def:pub NewMatchPage() -> JsxPage {
    state = use_app_state(); navigate = useNavigate(); has started: Ref[bool] = Ref(False); has error: bool = False;
    can with entry {
        if not started.current {
            started.current = True; today = new(Date).toISOString()[:10];
            id = state["createMatchDraft"].call(None, today);
            if id { navigate("/match/" + id + "/setup", {"replace": True}); }
            else { error = True; }
        }
    }
    return <section className="page narrow-page"><p>{"Choose a soccer team to create a match." if error else "Creating match setup…"}</p></section>;
}
