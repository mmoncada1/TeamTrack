export function isPlayerStatsQuestion(question) {
  return /\b(?:how many|stats|statistics|per game|playing time|minutes?|show me|tell me|what are|what is)\b/i.test(question) ||
    (/\b(?:goals|assists)\b/i.test(question) && !/\b(?:scored?|record|add|log|mark)\b/i.test(question));
}

export function playerStats(question, roster, matches) {
  const normalized = ` ${question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const matchesName = roster.filter((player) => {
    const full = player.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return full && (normalized.includes(` ${full} `) || normalized.includes(` ${full.split(" ")[0]} `));
  });
  if (matchesName.length !== 1) return null;
  const player = matchesName[0];
  const played = matches.filter((match) => match.players?.some((item) => item.player_id === player.id))
    .map((match) => ({ match, stats: match.players.find((item) => item.player_id === player.id) }));
  const goals = played.reduce((total, item) => total + (item.stats.goals || 0), 0);
  const assists = played.reduce((total, item) => total + (item.stats.assists || 0), 0);
  const minutes = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  const totalMs = played.reduce((total, item) => total + (item.stats.field_ms || 0), 0);
  const lines = played.map(({ match, stats }) =>
    `${match.date || "Undated"} vs ${match.opponent || "Opponent"}: ${stats.goals || 0} goal${stats.goals === 1 ? "" : "s"}, ${stats.assists || 0} assist${stats.assists === 1 ? "" : "s"}, ${minutes(stats.field_ms || 0)} on field${match.status === "ended" ? "" : " (in progress)"}.`);
  return `${player.name}: ${goals} goal${goals === 1 ? "" : "s"}, ${assists} assist${assists === 1 ? "" : "s"}, ${minutes(totalMs)} on field across ${played.length} match${played.length === 1 ? "" : "es"}.` +
    (lines.length ? `\n${lines.join("\n")}` : " No match history yet.");
}

