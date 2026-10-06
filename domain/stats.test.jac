import from .models { MatchSettings, ThresholdSetting }

def summary_game() -> Match {
    settings = MatchSettings(format="7v7", formation_id="7v7-2-3-1", half_length_minutes=25,
        number_of_halves=2, thresholds={"GK": ThresholdSetting(enabled=False, minutes=10)});
    return Match(id="m", team_id="t", team_name="Falcons", opponent_name="Tigers", date="2026-09-30",
        settings=settings, pending_formation_id="7v7-2-3-1", roster_player_ids=["p1", "p2"],
        events=[
            MatchEvent(id="start", type="MATCH_STARTED", match_clock_ms=0, timestamp=1000,
                data={"formation_id": "7v7-2-3-1", "assignments": {"gk": "p1"}, "unavailable_player_ids": []}),
            MatchEvent(id="goal", type="GOAL", match_clock_ms=60000, timestamp=61000,
                player_ids=["p1"], data={"team": "us", "is_own_goal": False, "scorer_id": "p1", "assister_id": None}),
            MatchEvent(id="end", type="MATCH_ENDED", match_clock_ms=120000, timestamp=121000)
        ]);
}

test "builds score and playing-time summaries" {
    players = [
        Player(id="p1", team_id="t", name="Alex", preferred_group="GK", jersey_number=1),
        Player(id="p2", team_id="t", name="Blair", preferred_group="DEF", jersey_number=2)
    ];
    result = build_match_summary(summary_game(), players, 121000);
    assert result.team_score == 1; assert result.opponent_score == 0;
    assert result.summaries[0].player_id == "p1"; assert result.summaries[0].total_field_ms == 120000;
    assert result.summaries[0].goals == 1; assert result.summaries[1].total_bench_ms == 120000;
}

test "describes goals and cards with roster names" {
    players = [Player(id="p1", team_id="t", name="Alex", preferred_group="FWD")];
    goal = MatchEvent(id="g", type="GOAL", match_clock_ms=1000, timestamp=2000,
        data={"team": "us", "is_own_goal": False, "scorer_id": "p1", "assister_id": None});
    card = MatchEvent(id="c", type="CARD", match_clock_ms=2000, timestamp=3000,
        data={"player_id": "p1", "color": "red", "second_yellow": False});
    assert describe_event(goal, players) == "Goal: Alex.";
    assert describe_event(card, players) == "Red card: Alex.";
}
