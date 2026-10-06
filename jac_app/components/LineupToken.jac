def:pub LineupToken(player: any) -> JsxElement {
    words = player.name.strip().split();
    initials = "".join([word[0].upper() for word in words[:2]]) if words else "?";
    group = player.preferred_group if player.preferred_group in ["GK", "DEF", "MID", "FWD"] else "DEF";
    return <div className={"lineup-token group-" + group}><div className="token-avatar">{initials}{<span className="girl-mark">G</span> if player.gender == "girl" else None}</div><span className="token-name">{player.name} ({group})</span></div>;
}
