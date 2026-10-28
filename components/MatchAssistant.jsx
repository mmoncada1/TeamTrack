import React, { useState } from "react";
import { getAccessToken } from "../state/cloud.js";

export function MatchAssistant({ game, players, summary, derived }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(event) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const token = await getAccessToken();
      const playerIds = new Set(game.roster_player_ids || []);
      const context = {
        match: {
          id: game.id, team_id: game.team_id, team_name: game.team_name,
          opponent_name: game.opponent_name, date: game.date,
          status: derived.status, clock_ms: derived.display_clock_ms,
          team_score: summary.team_score, opponent_score: summary.opponent_score,
        },
        players: players.filter((player) => player.team_id === game.team_id && playerIds.has(player.id)).map((player) => ({
          id: player.id, name: player.name, jersey_number: player.jersey_number,
          preferred_groups: player.preferred_groups, availability: player.availability,
        })),
        statistics: summary.summaries.map((item) => ({
          player_id: item.player_id, player_name: item.player_name,
          total_field_ms: item.total_field_ms, total_bench_ms: item.total_bench_ms,
          goals: item.goals, assists: item.assists, subs_in: item.subs_in, subs_out: item.subs_out,
        })),
        player_states: Object.values(derived.player_states || {}).map((item) => ({
          player_id: item.player_id, status: item.status, position_id: item.position_id,
          position_group: item.position_group, current_stint_ms: item.current_stint_ms,
        })),
        alerts: (game.active_alerts || []).filter((item) => item.status === "active").map((item) => ({
          player_id: item.player_id, position_group: item.position_group,
          threshold_minutes: item.threshold_minutes, recommendation: item.recommendation,
        })),
        events: (game.events || []).slice(-80).map((item) => ({
          type: item.type, match_clock_ms: item.match_clock_ms,
          player_ids: item.player_ids, note: item.note, data: item.data,
        })),
      };
      const response = await fetch("/api/match-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: prompt, context }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The assistant could not answer.");
      setAnswer(result.answer);
    } catch (err) {
      setError(err.message || "The assistant could not answer.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="match-assistant" aria-label="Match assistant">
    <h2>Ask TeamTrack</h2>
    <p>Ask about this match, player time, or recorded events. Suggestions are for the coach to review.</p>
    <form onSubmit={ask}>
      <label htmlFor="match-assistant-question">Your question</label>
      <textarea id="match-assistant-question" rows="2" maxLength="500" value={question}
        onChange={(event) => setQuestion(event.target.value)} placeholder="Summarize this match" />
      <button className="button primary" type="submit" disabled={busy || !question.trim()}>{busy ? "Thinking…" : "Ask"}</button>
    </form>
    {error && <p role="alert" className="match-assistant-error">{error}</p>}
    {answer && <div className="match-assistant-answer" aria-live="polite">{answer}</div>}
  </section>;
}
