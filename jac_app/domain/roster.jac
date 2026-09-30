"""Pure team and roster rules shared by the Jac UI and tests."""
import from .models { Player }
obj FieldError { has field: str, message: str; }
def clamp_min_girls(value: int | None) -> int { if value is None { return 2; } return min(11, max(1, value)); }
def normalize_position_groups(groups: list[str]) -> list[str] {
    valid = ["GK", "DEF", "MID", "FWD"]; result: list[str] = [];
    for group in groups { if group in valid and group not in result { result.append(group); } }
    return result;
}
def position_names(groups: list[str]) -> str {
    labels = {"GK": "Goalkeeper", "DEF": "Defender", "MID": "Midfielder", "FWD": "Forward"};
    return ", ".join([labels[group] for group in normalize_position_groups(groups)]);
}
def:pub jersey_label(number: int | None) -> str { return "—" if number is None else f"#{number}"; }
def validate_player(name: str, jersey_number: int | None, groups: list[str], gender: str | None,
    require_gender: bool, existing_players: list[Player], editing_player_id: str | None = None) -> list[FieldError] {
    errors: list[FieldError] = [];
    if not name.strip() { errors.append(FieldError(field="name", message="Name is required.")); }
    if jersey_number is not None {
        if jersey_number < 0 { errors.append(FieldError(field="jerseyNumber", message="Jersey number must be a non-negative whole number, or left blank.")); }
        else { for player in existing_players { if player.jersey_number == jersey_number and player.id != editing_player_id { errors.append(FieldError(field="jerseyNumber", message=f"Jersey #{jersey_number} is already used by {player.name}.")); break; } } }
    }
    if not normalize_position_groups(groups) { errors.append(FieldError(field="preferredGroup", message="Choose at least one position.")); }
    if require_gender and gender not in ["girl", "boy"] { errors.append(FieldError(field="gender", message="Choose girl or boy so co-ed matches can count girls on the field.")); }
    return errors;
}
def player_sort_key(player: Player) -> tuple[bool, int, str] {
    return (player.jersey_number is None, player.jersey_number if player.jersey_number is not None else 0, player.name.lower());
}
def sort_players(players: list[Player]) -> list[Player] { return sorted(players, key=player_sort_key); }

