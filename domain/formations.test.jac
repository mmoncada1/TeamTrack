test "contains the complete formation catalog" {
    formations = all_formations();
    assert len(formations) == 14;
    assert len(formations_for_format("7v7")) == 5;
    assert len(formations_for_format("9v9")) == 4;
    assert len(formations_for_format("11v11")) == 5;
}

test "every formation has the correct number of players" {
    assert formations_are_valid();
}

test "default formations match the original application" {
    assert default_formation_for_format("7v7").id == "7v7-2-3-1";
    assert default_formation_for_format("9v9").id == "9v9-3-3-2";
    assert default_formation_for_format("11v11").id == "11v11-4-4-2";
}

test "formation lookup preserves coordinates" {
    item = formation_by_id("11v11-4-2-3-1");
    assert item is not None;
    if item is not None {
        assert item.shape == "4-2-3-1";
        assert item.positions[0].id == "gk";
        assert item.positions[0].x == 50;
        assert item.positions[10].id == "fwd-c";
        assert item.positions[10].y == 12;
    }
}

test "unknown formation returns none" {
    assert formation_by_id("missing") is None;
}

