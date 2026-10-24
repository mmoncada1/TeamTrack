"""Marker for an unassigned soccer field position."""

def:pub EmptyPosition(label: str) -> JsxElement {
    return <span className="missing-position"><span className="missing-position-plus">+</span><span>{label}</span></span>;
}
