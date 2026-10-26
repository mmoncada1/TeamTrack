def voice_player(id: str, name: str) -> Player {
    return Player(id=id, team_id="team", name=name, preferred_group="MID");
}

test "resolves a spoken substitution by first or full name" {
    players = [voice_player("matteo", "Matteo Rossi"), voice_player("katie", "Katie Lee")];
    assignments = {"mid-c": "katie"};
    result = resolve_voice_substitution("Sub Matteo in for Katie.", players, assignments, ["matteo"]);
    assert result == {"in_id": "matteo", "out_id": "katie", "slot_id": "mid-c"};
    result = resolve_voice_substitution("Substitute Matteo Rossi in for Katie Lee", players, assignments, ["matteo"]);
    assert result["slot_id"] == "mid-c";
}

test "accepts a small speech recognition spelling error" {
    players = [voice_player("matteo", "Matteo Rossi"), voice_player("henry", "Henry Lee")];
    result = resolve_voice_substitution("sub Mateo in for Henry", players, {"mid-c": "henry"}, ["matteo"]);
    assert result == {"in_id": "matteo", "out_id": "henry", "slot_id": "mid-c"};
    result = resolve_voice_substitution("Mateo in for Henry", players, {"mid-c": "henry"}, ["matteo"]);
    assert result == {"in_id": "matteo", "out_id": "henry", "slot_id": "mid-c"};
    result = resolve_voice_substitution("sub Matteo in for Henrry", players, {"mid-c": "henry"}, ["matteo"]);
    assert result["out_id"] == "henry";
}

test "does not guess when fuzzy matches tie or a name is too different" {
    players = [voice_player("matteo", "Matteo Rossi"), voice_player("matheo", "Matheo Smith"),
        voice_player("henry", "Henry Lee")];
    result = resolve_voice_substitution("sub Mateo in for Henry", players, {"mid-c": "henry"}, ["matteo", "matheo"]);
    assert "More than one" in result["error"];
    result = resolve_voice_substitution("sub Mario in for Henry", players, {"mid-c": "henry"}, ["matteo", "matheo"]);
    assert "Could not find" in result["error"];
}

test "rejects ambiguous and invalid spoken substitutions" {
    players = [voice_player("matteo-a", "Matteo Rossi"), voice_player("matteo-b", "Matteo Smith"),
        voice_player("katie", "Katie Lee"), voice_player("sam", "Sam Lee")];
    assignments = {"mid-c": "katie"};
    assert "More than one" in resolve_voice_substitution("Sub Matteo in for Katie", players, assignments, ["matteo-a", "matteo-b"])["error"];
    assert "not on the bench" in resolve_voice_substitution("Sub Katie in for Sam", players, assignments, ["matteo-a", "matteo-b", "sam"])["error"];
    assert "not on the field" in resolve_voice_substitution("Sub Matteo Rossi in for Sam", players, assignments, ["matteo-a", "matteo-b", "sam"])["error"];
    assert "Say a command" in resolve_voice_substitution("Matteo for Katie", players, assignments, ["matteo-a"])["error"];
}
