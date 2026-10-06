import from .validation { formation_errors, play_errors }

def sample_formation() -> Formation {
    return new_formation("team-1", "formation-1", ["q", "c", "x", "y", "z", "w", "b"], 10);
}

test "new football formation has seven slots and distinct snap roles" {
    formation = sample_formation();
    assert len(formation.players) == 7;
    assert formation.quarterback_id == "q" and formation.snapper_id == "c";
    assert not formation_errors(formation);
}

test "autofill respects team, availability, and existing assignments" {
    formation = sample_formation(); formation.players[0].roster_player_id = "already";
    roster = [Player(id="already", team_id="team-1", name="Existing", preferred_group="MID", jersey_number=9),
        Player(id="first", team_id="team-1", name="First", preferred_group="MID", jersey_number=1),
        Player(id="out", team_id="team-1", name="Out", preferred_group="MID", availability="unavailable", jersey_number=2),
        Player(id="other", team_id="team-2", name="Other", preferred_group="MID", jersey_number=3)];
    filled = autofill_from_roster(formation, roster, 20);
    assert filled.players[0].roster_player_id == "already";
    assert filled.players[1].roster_player_id == "first";
    assert filled.players[2].roster_player_id is None;
    assert formation.players[1].roster_player_id is None;
}

test "play is an independent formation snapshot" {
    formation = sample_formation(); play = play_from_formation(formation, "play-1", "snap-1", 20);
    formation.players[0].position.x = 4;
    assert play.players[0].position.x == 50;
    assert play.ball_actions[0].from_player_id == "c";
    assert not play_errors(play);
}

test "drive order changes without losing repeated calls" {
    items = [DriveEntry(id="a", play_id="play"), DriveEntry(id="b", play_id="play")];
    moved = move_drive_entry(items, 0, 1);
    assert [item.id for item in moved] == ["b", "a"];
    assert [item.id for item in items] == ["a", "b"];
}
