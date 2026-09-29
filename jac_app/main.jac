"""TeamTrack Jac application entry point."""
import "./assets/main.css";
import "./assets/crud.css";
import from .state.AppState { AppStateProvider }
def:pub app(children: any) -> JsxElement { return <AppStateProvider>{children}</AppStateProvider>; }

