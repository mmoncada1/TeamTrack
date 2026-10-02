"""Shared TeamTrack domain model.

The first migration slice keeps these as plain Jac objects so the same model
can be checked in server-side tests and emitted into the browser client.
String-valued status fields intentionally preserve the JSON representation of
the original TypeScript application.
"""

obj Team {
    has id: str,
        name: str,
        coed: bool = False,
        min_girls_on_field: int | None = None,
        photo_id: str | None = None,
        created_at: int = 0,
        updated_at: int = 0;
}

obj Player {
    has id: str,
        team_id: str,
        name: str,
        preferred_group: str,
        availability: str = "active",
        jersey_number: int | None = None,
        preferred_groups: list[str] = [],
        gender: str | None = None,
        notes: str | None = None,
        photo_id: str | None = None,
        created_at: int = 0,
        updated_at: int = 0;
}

obj FormationPosition {
    has id: str,
        label: str,
        group: str,
        x: int,
        y: int;
}

obj Formation {
    has id: str,
        format: str,
        name: str,
        shape: str,
        positions: list[FormationPosition];
}

obj ThresholdSetting {
    has enabled: bool,
        minutes: int;
}

obj MatchSettings {
    has format: str,
        formation_id: str,
        half_length_minutes: int,
        number_of_halves: int,
        thresholds: dict[str, ThresholdSetting],
        goalkeeper_rotation_enabled: bool = False,
        alert_sound_enabled: bool = False;
}

obj MatchEvent {
    has id: str,
        type: str,
        match_clock_ms: int,
        timestamp: int,
        player_ids: list[str] = [],
        note: str | None = None,
        data: dict[str, any] = {};
}

obj Alert {
    has id: str,
        player_id: str,
        position_group: str,
        threshold_minutes: int,
        stint_start_ms: int,
        created_at_clock_ms: int,
        status: str = "active",
        snooze_until_clock_ms: int | None = None,
        recommendation: dict[str, str] | None = None;
}

obj Match {
    has id: str,
        team_id: str,
        team_name: str,
        opponent_name: str,
        date: str,
        settings: MatchSettings,
        pending_formation_id: str,
        kickoff_time: str | None = None,
        title: str | None = None,
        roster_player_ids: list[str] = [],
        unavailable_player_ids: list[str] = [],
        pending_assignments: dict[str, str] = {},
        events: list[MatchEvent] = [],
        active_alerts: list[Alert] = [],
        created_at: int = 0,
        updated_at: int = 0;
}

obj SavedLineup {
    has id: str,
        team_id: str,
        name: str,
        format: str,
        formation_id: str,
        assignments: dict[str, str] = {},
        created_at: int = 0,
        updated_at: int = 0;
}

obj AppSettings {
    has theme: str = "light",
        alert_sound_enabled: bool = False,
        reduced_motion: bool = False,
        field_locked: bool = False;
}

def default_thresholds() -> dict[str, ThresholdSetting] {
    return {
        "GK": ThresholdSetting(enabled=False, minutes=10),
        "DEF": ThresholdSetting(enabled=True, minutes=5),
        "MID": ThresholdSetting(enabled=True, minutes=4),
        "FWD": ThresholdSetting(enabled=True, minutes=5)
    };
}

def player_count_for_format(format: str) -> int {
    counts = {"7v7": 7, "9v9": 9, "11v11": 11};
    if format not in counts {
        raise ValueError(f"Unknown match format: {format}");
    }
    return counts[format];
}

