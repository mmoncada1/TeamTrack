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

export function isSubstitutionQuestion(question) {
  return /\b(sub|subs|substitute|substitution|swap|replace|rotate|rotation)\b|\bbring\s+(?:in|on)\b|\btake\s+(?:off|out)\b/i.test(question);
}

export function suggestSubstitution(context) {
  if (!["in_progress", "paused", "half_time"].includes(context.match.status)) return null;
  const states = Array.isArray(context.player_states) ? context.player_states : [];
  const players = Array.isArray(context.players) ? context.players : [];
  const alerts = Array.isArray(context.alerts) ? context.alerts : [];
  for (const alert of alerts) {
    const outState = states.find((state) => state.player_id === alert.player_id);
    const suggestion = {
      incoming_player_id: alert.recommendation?.in_player_id,
      outgoing_player_id: alert.player_id,
      position_id: outState?.position_id,
    };
    if (validSubstitution(suggestion, context)) return suggestion;
  }
  const bench = states.filter((state) => state.status === "bench");
  const field = states.filter((state) => state.status === "field" && state.position_id && state.position_group !== "GK")
    .sort((a, b) => (b.current_stint_ms || 0) - (a.current_stint_ms || 0));
  for (const outgoing of field) {
    const rankedBench = [...bench].sort((a, b) => {
      const aPlayer = players.find((player) => player.id === a.player_id);
      const bPlayer = players.find((player) => player.id === b.player_id);
      const aMatches = aPlayer?.preferred_groups?.includes(outgoing.position_group) ? 1 : 0;
      const bMatches = bPlayer?.preferred_groups?.includes(outgoing.position_group) ? 1 : 0;
      return bMatches - aMatches || (b.current_stint_ms || 0) - (a.current_stint_ms || 0);
    });
    for (const incoming of rankedBench) {
      const suggestion = {
        incoming_player_id: incoming.player_id,
        outgoing_player_id: outgoing.player_id,
        position_id: outgoing.position_id,
      };
      if (validSubstitution(suggestion, context)) return suggestion;
    }
  }
  return null;
}

export function substitutionAnswer(suggestion, context) {
  const incoming = context.players.find((player) => player.id === suggestion.incoming_player_id)?.name || "the bench player";
  const outgoing = context.players.find((player) => player.id === suggestion.outgoing_player_id)?.name || "the field player";
  const alert = context.alerts?.find((item) => item.player_id === suggestion.outgoing_player_id &&
    item.recommendation?.in_player_id === suggestion.incoming_player_id);
  return `I suggest ${incoming} for ${outgoing}${alert ? " based on the active substitution alert" : " based on current playing and bench time"}. Review the swap before accepting it.`;
}
