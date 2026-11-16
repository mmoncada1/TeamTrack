function findPlayer(question, roster) {
  const words = ` ${question.toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
  const fullMatches = roster.filter((player) => words.includes(` ${player.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `));
  if (fullMatches.length === 1) return fullMatches[0];
  if (fullMatches.length > 1) return null;
  const firstMatches = roster.filter((player) => words.includes(` ${player.name.toLowerCase().split(/\s+/)[0]} `));
  return firstMatches.length === 1 ? firstMatches[0] : null;
}

function namedStats(question, player, matches) {
  const games = matches.flatMap((match) => {
    const entry = match.players?.find((item) => item.player_id === player.id);
    return entry ? [{ date: match.date || "Undated", opponent: match.opponent || "Opponent",
      status: match.status, goals: Number(entry.goals) || 0, assists: Number(entry.assists) || 0,
      fieldMs: Number(entry.field_ms) || 0 }] : [];
  });
  const goals = games.reduce((sum, game) => sum + game.goals, 0);
  const assists = games.reduce((sum, game) => sum + game.assists, 0);
  const goalQuestion = /\b(?:goal|goals|score|scored|scoring)\b/i.test(question) &&
    !/\b(?:stats?|statistics|assists?|minutes?|time)\b/i.test(question);
  if (goalQuestion) {
    const scoringGames = games.filter((game) => game.goals > 0);
    return { answer: `${player.name} has scored ${goals} goal${goals === 1 ? "" : "s"}.` +
      (scoringGames.length ? `\n${scoringGames.map((game) => `${game.date} vs ${game.opponent}: ${game.goals} goal${game.goals === 1 ? "" : "s"}.`).join("\n")}` : "") };
  }
  return { answer: `${player.name}'s match stats`, stats: { name: player.name, goals, assists,
    fieldMs: games.reduce((sum, game) => sum + game.fieldMs, 0), matches: games.length, games } };
}

export function rosterStatsAnswer(question, roster, matches) {
  const q = question.toLowerCase();
  const asksStats = /\b(?:who|which|whose|what|how many|stats?|statistics|leaders?|top|most|least|fewest|highest|lowest|average|per game|playing time|minutes?|goals?|assists?|scored?|scoring)\b/i.test(q);
  if (!asksStats || /^\s*(?:add|record|log|mark|create|generate|make|build)\b/i.test(q)) return null;

  const named = findPlayer(question, roster);
  if (named) return namedStats(question, named, matches);

  const metric = /\bassist/i.test(q) ? "assists" : /\b(?:minutes?|playing time|time on (?:the )?field)\b/i.test(q) ? "minutes" : "goals";
  const comparative = /\b(?:who|which|whose|leaders?|top|most|least|fewest|highest|lowest|best|leading)\b/i.test(q);
  if (!comparative) return { answer: "I couldn't identify one roster player. Use a full name if teammates share a first name." };
  if (!matches.length) return { answer: "There is no match history to compare yet." };

  const totals = roster.map((player) => {
    const played = matches.flatMap((match) => match.players?.filter((entry) => entry.player_id === player.id) || []);
    return { name: player.name, matches: played.length,
      goals: played.reduce((sum, entry) => sum + (Number(entry.goals) || 0), 0),
      assists: played.reduce((sum, entry) => sum + (Number(entry.assists) || 0), 0),
      minutes: played.reduce((sum, entry) => sum + (Number(entry.field_ms) || 0), 0) / 60000 };
  }).filter((entry) => entry.matches);
  if (!totals.length) return { answer: "There are no player stats in match history yet." };

  const perGame = /\b(?:per game|per match|average)\b/i.test(q);
  const ascending = /\b(?:least|fewest|lowest)\b/i.test(q);
  const value = (entry) => entry[metric] / (perGame ? entry.matches : 1);
  totals.sort((a, b) => (ascending ? value(a) - value(b) : value(b) - value(a)) || a.name.localeCompare(b.name));
  const best = value(totals[0]);
  const leaders = totals.filter((entry) => Math.abs(value(entry) - best) < 0.000001);
  const unit = metric === "minutes" ? "minutes" : metric;
  const display = (number) => Number.isInteger(number) ? String(number) : number.toFixed(1);
  return { answer: `${leaders.map((entry) => entry.name).join(" and ")} ${leaders.length === 1 ? "has" : "have"} the ${ascending ? "fewest" : "most"} ${unit}${perGame ? " per game" : ""}: ${display(best)}${perGame ? " per game" : ""}.` };
}
