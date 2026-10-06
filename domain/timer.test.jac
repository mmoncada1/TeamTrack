test "starts at zero and accumulates while running" {
    t0 = 1_000_000;
    clock = start_clock(t0);
    assert clock.status == "in_progress";
    assert get_match_clock_ms(clock, t0) == 0;
    assert get_match_clock_ms(clock, t0 + 5000) == 5000;
}

test "freezes elapsed time on pause" {
    t0 = 1_000_000;
    clock = pause_clock(start_clock(t0), t0 + 10_000);
    assert clock.status == "paused";
    assert clock.clock_offset_ms == 10_000;
    assert not is_clock_running(clock);
    assert get_match_clock_ms(clock, t0 + 60_000) == 10_000;
}

test "resumes without counting paused time" {
    t0 = 1_000_000;
    clock = pause_clock(start_clock(t0), t0 + 10_000);
    clock = resume_clock(clock, t0 + 50_000);
    assert get_match_clock_ms(clock, t0 + 50_000) == 10_000;
    assert get_match_clock_ms(clock, t0 + 55_000) == 15_000;
}

test "supports multiple pause and resume cycles" {
    clock = pause_clock(start_clock(0), 5000);
    clock = resume_clock(clock, 20_000);
    clock = pause_clock(clock, 25_000);
    clock = resume_clock(clock, 100_000);
    assert get_match_clock_ms(clock, 130_000) == 40_000;
}

test "halts at half time and ends permanently" {
    half = halt_for_half_time(start_clock(0), 15_000);
    assert half.status == "half_time";
    assert get_match_clock_ms(half, 100_000) == 15_000;
    ended = end_clock(start_clock(0), 30_000);
    assert ended.status == "ended";
    assert get_match_clock_ms(ended, 999_999) == 30_000;
}

test "formats match clock values" {
    assert format_clock(0) == "0:00";
    assert format_clock(65_000) == "1:05";
    assert format_clock(3_661_000) == "1:01:01";
}

