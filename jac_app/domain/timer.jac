"""Timestamp-based match clock ported from src/lib/timer.ts."""

obj ClockState {
    has status: str,
        clock_running_since: int | None,
        clock_offset_ms: int;
}

def is_clock_running(clock: ClockState) -> bool {
    return clock.status == "in_progress" and clock.clock_running_since is not None;
}

def get_match_clock_ms(clock: ClockState, now_ms: int) -> int {
    if is_clock_running(clock) {
        running_since = clock.clock_running_since;
        if running_since is not None {
            return clock.clock_offset_ms + max(0, now_ms - running_since);
        }
    }
    return clock.clock_offset_ms;
}

def start_clock(now_ms: int) -> ClockState {
    return ClockState(
        status="in_progress",
        clock_running_since=now_ms,
        clock_offset_ms=0
    );
}

def pause_clock(clock: ClockState, now_ms: int) -> ClockState {
    return ClockState(
        status="paused",
        clock_running_since=None,
        clock_offset_ms=get_match_clock_ms(clock, now_ms)
    );
}

def resume_clock(clock: ClockState, now_ms: int) -> ClockState {
    return ClockState(
        status="in_progress",
        clock_running_since=now_ms,
        clock_offset_ms=clock.clock_offset_ms
    );
}

def halt_for_half_time(clock: ClockState, now_ms: int) -> ClockState {
    return ClockState(
        status="half_time",
        clock_running_since=None,
        clock_offset_ms=get_match_clock_ms(clock, now_ms)
    );
}

def end_clock(clock: ClockState, now_ms: int) -> ClockState {
    return ClockState(
        status="ended",
        clock_running_since=None,
        clock_offset_ms=get_match_clock_ms(clock, now_ms)
    );
}

def format_clock(ms: int) -> str {
    total_seconds = max(0, ms // 1000);
    hours = total_seconds // 3600;
    minutes = (total_seconds % 3600) // 60;
    seconds = total_seconds % 60;
    mm = str(minutes).zfill(2);
    ss = str(seconds).zfill(2);
    if hours > 0 {
        return f"{hours}:{mm}:{ss}";
    }
    return f"{minutes}:{ss}";
}

def ms_to_minutes(ms: int) -> float {
    return ms / 60000;
}

def minutes_to_ms(minutes: int) -> int {
    return minutes * 60000;
}

