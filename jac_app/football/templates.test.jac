import from .validation { play_errors }

test "all starter concepts produce valid independent plays" {
    definitions = starter_definitions(); assert len(definitions) == 15;
    names = [item["name"] for item in definitions]; assert len(set(names)) == 15;
    ids = ["q", "c", "x", "y", "z", "w", "b"];
    for item in definitions {
        play = starter_play("team", item["name"], "play", ids, "snap", "exchange", 10);
        assert play.name == item["name"];
        assert play.tags == item["tags"];
        assert len(play.players) == 7;
        assert play.formation_id is None;
        assert not play_errors(play);
    }
}

test "motion and exchange starters retain their special geometry" {
    ids = ["q", "c", "x", "y", "z", "w", "b"];
    jet = starter_play("team", "Jet Motion Handoff", "jet", ids, "snap", "exchange", 10);
    assert len(jet.players[3].motion) == 1;
    assert jet.ball_actions[1].type == "handoff";
    assert jet.ball_actions[1].to_player_id == "y";
    pitch = starter_play("team", "Basic Pitch", "pitch", ids, "snap2", "exchange2", 10);
    assert pitch.ball_actions[1].type == "pitch";
    assert pitch.ball_actions[1].target is not None;
}
