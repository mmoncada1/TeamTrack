def sample_game() -> Match {
    return Match(id="m1", team_id="t1", team_name="Falcons", opponent_name="Tigers", date="2026-10-01",
        settings=MatchSettings(format="7v7", formation_id="7v7-2-3-1", half_length_minutes=25,
            number_of_halves=2, thresholds={}), pending_formation_id="7v7-2-3-1",
        roster_player_ids=["gk", "def-l", "def-r", "mid-l", "mid-c", "mid-r", "fwd", "bench-a", "bench-b"],
        unavailable_player_ids=[], pending_assignments={"gk": "gk", "def-l": "def-l", "def-r": "def-r",
            "mid-l": "mid-l", "mid-c": "mid-c", "mid-r": "mid-r", "fwd-c": "fwd"},
        events=[], active_alerts=[], created_at=0, updated_at=0);
}

test "derives setup state from pending assignments" {
    state = derive_match_state(sample_game(), 5000);
    assert state.status == "setup"; assert state.match_clock_ms == 0; assert not state.is_clock_running;
    assert state.assignments["mid-c"] == "mid-c"; assert state.player_states["mid-c"].status == "field";
    assert state.player_states["bench-a"].status == "bench";
}

test "runs pauses resumes and completes both halves" {
    game = start_match(sample_game(), 1000);
    running = derive_match_state(game, 61_000);
    assert running.status == "in_progress"; assert running.match_clock_ms == 60_000;
    game = pause_match(game, 61_000);
    assert derive_match_state(game, 999_000).match_clock_ms == 60_000;
    game = resume_match(game, 101_000);
    assert derive_match_state(game, 131_000).match_clock_ms == 90_000;
    game = go_to_half_time(game, 131_000);
    half = derive_match_state(game, 200_000);
    assert half.status == "half_time"; assert half.display_clock_ms == 0;
    game = resume_match(game, 201_000);
    second = derive_match_state(game, 221_000);
    assert second.current_half == 2; assert second.display_clock_ms == 20_000;
    game = end_match(game, 221_000);
    ended = derive_match_state(game, 999_000);
    assert ended.status == "ended"; assert ended.match_clock_ms == 110_000; assert not ended.is_clock_running;
}

test "tracks substitutions and exact field and bench time" {
    game = start_match(sample_game(), 0);
    game = substitute_player(game, "bench-a", "mid-c", 180_000);
    game = substitute_player(game, "bench-b", "mid-c", 360_000);
    game = substitute_player(game, "mid-c", "mid-c", 480_000);
    state = derive_match_state(game, 600_000);
    assert state.player_states["mid-c"].total_field_ms == 300_000;
    assert state.player_states["mid-c"].subs_out == 1; assert state.player_states["mid-c"].subs_in == 1;
    assert state.player_states["bench-a"].total_field_ms == 180_000;
    assert state.player_states["bench-b"].total_field_ms == 120_000;
}

test "moves and swaps players without resetting field stints" {
    game = start_match(sample_game(), 0);
    game = swap_players(game, "mid-l", "mid-r", 60_000);
    game = move_player(game, "mid-l", "BENCH", 120_000);
    game = move_player(game, "bench-a", "mid-r", 180_000);
    state = derive_match_state(game, 240_000);
    assert state.assignments["mid-l"] == "mid-r"; assert state.assignments["mid-r"] == "bench-a";
    assert state.player_states["mid-l"].total_field_ms == 120_000;
    assert state.player_states["mid-r"].total_field_ms == 240_000;
    assert state.player_states["bench-a"].total_field_ms == 60_000;
}

test "records edits deletes and undoes goals deterministically" {
    game = start_match(sample_game(), 0);
    game = record_goal(game, "us", False, "fwd", "mid-c", "opening goal", 60_000);
    goal_id = game.events[-1].id;
    game = record_goal(game, "opponent", False, None, None, None, 90_000);
    state = derive_match_state(game, 120_000);
    assert state.team_score == 1; assert state.opponent_score == 1;
    assert state.player_states["fwd"].goals == 1; assert state.player_states["mid-c"].assists == 1;
    game = update_goal(game, goal_id, "us", False, "bench-a", "fwd", "corrected", 130_000);
    state = derive_match_state(game, 130_000);
    assert state.player_states["bench-a"].goals == 1; assert state.player_states["fwd"].assists == 1;
    game = delete_event(game, goal_id, 140_000);
    assert derive_match_state(game, 140_000).team_score == 0;
    assert can_undo(game); game = undo_last_action(game, 150_000);
    assert derive_match_state(game, 150_000).opponent_score == 0;
}

test "second yellow sends a player off and undo restores them" {
    game = start_match(sample_game(), 0);
    game = record_card(game, "def-l", "yellow", 60_000);
    game = record_card(game, "def-l", "yellow", 120_000);
    state = derive_match_state(game, 180_000);
    assert "def-l" in state.sent_off_player_ids; assert "def-l" not in state.assignments.values();
    assert state.player_states["def-l"].total_field_ms == 120_000;
    game = undo_last_action(game, 180_000); state = derive_match_state(game, 180_000);
    assert "def-l" not in state.sent_off_player_ids; assert state.assignments["def-l"] == "def-l";
}

test "handles injury return removal and late join" {
    game = start_match(sample_game(), 0);
    game = mark_player_injured(game, "mid-c", 60_000);
    assert "mid-c" in derive_match_state(game, 90_000).injured_player_ids;
    game = return_player_to_bench(game, "mid-c", 90_000);
    assert derive_match_state(game, 100_000).player_states["mid-c"].status == "bench";
    game = remove_player_from_match(game, "bench-b", 100_000);
    assert "bench-b" not in derive_match_state(game, 110_000).included_player_ids;
    game = add_player_to_match(game, "late", 120_000);
    state = derive_match_state(game, 180_000);
    assert "late" in state.included_player_ids; assert state.player_states["late"].total_bench_ms == 60_000;
}

test "changes formations and retains same-group players" {
    game = start_match(sample_game(), 0);
    changed = change_formation(game, "7v7-2-2-2", 60_000);
    state = derive_match_state(changed.game, 120_000);
    assert state.formation_id == "7v7-2-2-2"; assert len(state.assignments) == 6;
    assert len([item for item in ["mid-l", "mid-c", "mid-r"] if item not in state.assignments.values()]) == 1;
}

test "records and edits notes without making notes undoable" {
    game = start_match(sample_game(), 0);
    game = record_note(game, "Pressing well", 30_000);
    note_id = game.events[-1].id;
    game = update_note(game, note_id, "Drop deeper", 40_000);
    assert game.events[-1].note == "Drop deeper"; assert not can_undo(game);
    game = delete_event(game, note_id, 50_000);
    assert len(game.events) == 1;
}
