import from .models { Match, MatchSettings, Player }
import from .live_match { start_match, derive_match_state, move_player, record_goal, end_match }
import from .stats { build_match_summary }

def assistant_game() -> Match {
    return Match(id="match-1", team_id="team-1", team_name="TeamTrack", opponent_name="Visitors",
        date="2026-11-13", settings=MatchSettings(format="7v7", formation_id="7v7-2-3-1",
            half_length_minutes=25, number_of_halves=2, thresholds={}), pending_formation_id="7v7-2-3-1",
        roster_player_ids=["katie", "matteo", "lauren", "audrey", "henry", "spencer"],
        pending_assignments={"mid-c": "katie", "def-l": "lauren", "fwd-c": "henry"},
        events=[], active_alerts=[], created_at=0, updated_at=0);
}

def assistant_players() -> list[Player] {
    return [Player(id="katie", team_id="team-1", name="Katie", preferred_group="MID", gender="girl"),
        Player(id="matteo", team_id="team-1", name="Matteo", preferred_group="MID", gender="boy"),
        Player(id="lauren", team_id="team-1", name="Lauren", preferred_group="DEF", gender="girl"),
        Player(id="audrey", team_id="team-1", name="Audrey", preferred_group="DEF", gender="girl"),
        Player(id="henry", team_id="team-1", name="Henry", preferred_group="FWD", gender="boy"),
        Player(id="spencer", team_id="team-1", name="Spencer", preferred_group="FWD", gender="boy")];
}

test "a queued preview does not change playing time until applied" {
    game = start_match(assistant_game(), 0);
    proposal = {"incoming_player_id": "matteo", "outgoing_player_id": "katie", "position_id": "mid-c"};
    before = derive_match_state(game, 120_000);
    assert before.assignments["mid-c"] == "katie";
    assert before.player_states["matteo"].total_field_ms == 0;
    applied = apply_substitution_plan(game, [proposal], assistant_players(), None, 120_000);
    assert "error" not in applied;
    after = derive_match_state(applied["game"], 180_000);
    assert after.assignments["mid-c"] == "matteo";
    assert after.player_states["matteo"].total_field_ms == 60_000;
    assert after.player_states["katie"].total_field_ms == 120_000;
    replay = apply_substitution_plan(applied["game"], [proposal], assistant_players(), None, 180_000);
    assert "error" in replay;
    assert len([event for event in applied["game"].events if event.type == "SUBSTITUTION"]) == 1;
}

test "a changed lineup or combined coed violation rejects the whole proposal" {
    game = start_match(assistant_game(), 0);
    proposal = {"incoming_player_id": "matteo", "outgoing_player_id": "katie", "position_id": "mid-c"};
    changed = move_player(game, "katie", "BENCH", 60_000);
    assert "error" in apply_substitution_plan(changed, [proposal], assistant_players(), None, 90_000);
    result = apply_substitution_plan(game, [proposal], assistant_players(), 2, 90_000);
    assert "error" in result;
    assert len(game.events) == 1;
}

test "goal, several substitutions, and final whistle retain score and recap" {
    game = start_match(assistant_game(), 0);
    goal = {"match_id": game.id, "team_score": 0, "opponent_score": 0, "event_count": len(game.events)};
    assert goal_proposal_is_current(game, goal, 30_000);
    game = record_goal(game, "us", False, "katie", None, None, 30_000);
    assert not goal_proposal_is_current(game, goal, 31_000);
    plan = [{"incoming_player_id": "matteo", "outgoing_player_id": "katie", "position_id": "mid-c"},
        {"incoming_player_id": "audrey", "outgoing_player_id": "lauren", "position_id": "def-l"},
        {"incoming_player_id": "spencer", "outgoing_player_id": "henry", "position_id": "fwd-c"}];
    assert len([event for event in game.events if event.type == "SUBSTITUTION"]) == 0;
    result = apply_substitution_plan(game, plan, assistant_players(), None, 120_000);
    assert "error" not in result;
    game = end_match(result["game"], 240_000);
    recap = build_match_summary(game, assistant_players(), 999_000);
    assert recap.team_score == 1; assert recap.opponent_score == 0;
    assert recap.match_clock_ms == 240_000;
    assert len([event for event in game.events if event.type == "SUBSTITUTION"]) == 3;
    assert game.events[-1].type == "MATCH_ENDED";
    assert derive_match_state(game, 999_000).status == "ended";
    for item in recap.summaries {
        if item.player_id in ["matteo", "audrey", "spencer"] { assert item.total_field_ms == 120_000; }
        if item.player_id in ["katie", "lauren", "henry"] { assert item.total_field_ms == 120_000; }
    }
}
