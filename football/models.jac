"""Seven-player flag football design records."""

obj Point { has x: float, y: float; }

obj Route {
    has type: str, points: list[Point] = [], depth: float = 12.0, direction: int = 1;
}

obj PlayerSlot {
    has id: str, label: str, position: Point, route: Route,
        roster_player_id: str | None = None, motion: list[Point] = [];
}

obj Formation {
    has id: str, team_id: str, name: str, players: list[PlayerSlot],
        quarterback_id: str, snapper_id: str, side: str = "offense",
        created_at: int = 0, updated_at: int = 0;
}

obj BallAction {
    has id: str, type: str, from_player_id: str, to_player_id: str,
        order: int, fake: bool = False, target: Point | None = None;
}

obj Drawing {
    has id: str, tool: str, color: str, width: float, points: list[Point];
}

obj Play {
    has id: str, team_id: str, name: str, players: list[PlayerSlot],
        quarterback_id: str, snapper_id: str, side: str = "offense",
        schema_version: int = 1, description: str = "", formation_id: str | None = None,
        tags: list[str] = [], ball_actions: list[BallAction] = [], drawings: list[Drawing] = [],
        created_at: int = 0, updated_at: int = 0;
}

obj DriveEntry { has id: str, play_id: str; }

obj DrivePlan {
    has id: str, team_id: str, name: str, entries: list[DriveEntry] = [],
        created_at: int = 0, updated_at: int = 0;
}

obj Whiteboard {
    has id: str, team_id: str, drawings: list[Drawing] = [], updated_at: int = 0;
}
