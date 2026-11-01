export function validSubstitution(suggestion, context) {
  if (!suggestion || !["in_progress", "paused", "half_time"].includes(context.match.status)) return false;
  const { incoming_player_id: incoming, outgoing_player_id: outgoing, position_id: position } = suggestion;
  if (typeof incoming !== "string" || typeof outgoing !== "string" || typeof position !== "string" ||
      !incoming || !outgoing || !position || incoming === outgoing) return false;
  const states = Array.isArray(context.player_states) ? context.player_states : [];
  const players = Array.isArray(context.players) ? context.players : [];
  const outState = states.find((item) => item.player_id === outgoing);
  const inState = states.find((item) => item.player_id === incoming);
  if (outState?.status !== "field" || outState.position_id !== position || inState?.status !== "bench" ||
      !players.some((item) => item.id === incoming) || !players.some((item) => item.id === outgoing)) return false;
  if (context.team?.coed && Number.isInteger(context.team.min_girls_on_field)) {
    const genders = new Map(players.map((item) => [item.id, item.gender]));
    const field = states.filter((item) => item.status === "field");
    const beforeGirls = field.filter((item) => genders.get(item.player_id) === "girl").length;
    const beforeOthers = field.length - beforeGirls;
    const afterGirls = beforeGirls - (genders.get(outgoing) === "girl" ? 1 : 0) + (genders.get(incoming) === "girl" ? 1 : 0);
    const afterOthers = beforeOthers - (genders.get(outgoing) === "girl" ? 0 : 1) + (genders.get(incoming) === "girl" ? 0 : 1);
    if (afterOthers > 0 && afterGirls < context.team.min_girls_on_field &&
        afterGirls <= beforeGirls && afterOthers >= beforeOthers) return false;
  }
  return true;
}
