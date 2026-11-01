import React, { useEffect, useRef, useState } from "react";
import { getAccessToken } from "../state/cloud.js";

export function MatchAssistant({ game, players, summary, derived, team, onAcceptSubstitution, fieldLocked = false }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const acceptButton = useRef(null);
  const dismissButton = useRef(null);

  useEffect(() => {
    if (!suggestion) return;
    const previousFocus = document.activeElement;
    (acceptButton.current?.disabled ? dismissButton.current : acceptButton.current)?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") setSuggestion(null);
      if (event.key === "Tab") {
        const first = acceptButton.current?.disabled ? dismissButton.current : acceptButton.current;
        const last = dismissButton.current;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [suggestion]);

  const incoming = suggestion && players.find((player) => player.id === suggestion.incoming_player_id);
  const outgoing = suggestion && players.find((player) => player.id === suggestion.outgoing_player_id);
  const suggestionCurrent = suggestion && suggestion.match_id === game.id && incoming && outgoing &&
    derived.player_states?.[suggestion.incoming_player_id]?.status === "bench" &&
    derived.player_states?.[suggestion.outgoing_player_id]?.status === "field" &&
    derived.player_states?.[suggestion.outgoing_player_id]?.position_id === suggestion.position_id &&
    derived.assignments?.[suggestion.position_id] === suggestion.outgoing_player_id &&
    !fieldLocked && !["setup", "ended"].includes(derived.status);

  function acceptSuggestion() {
    if (!suggestionCurrent || !onAcceptSubstitution) return;
    try {
      const error = onAcceptSubstitution(suggestion);
      if (error) setError(error);
      else setSuggestion(null);
    } catch (err) {
      setError(err.message || "Could not make that substitution.");
    }
  }

  async function ask(event) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    setSuggestion(null);
    try {
      const token = await getAccessToken();
      const playerIds = new Set(game.roster_player_ids || []);
      const context = {
        team: team ? { coed: team.coed, min_girls_on_field: team.min_girls_on_field } : undefined,
        match: {
          id: game.id, team_id: game.team_id, team_name: game.team_name,
          opponent_name: game.opponent_name, date: game.date,
          status: derived.status, clock_ms: derived.display_clock_ms,
          team_score: summary.team_score, opponent_score: summary.opponent_score,
        },
        players: players.filter((player) => player.team_id === game.team_id && playerIds.has(player.id)).map((player) => ({
          id: player.id, name: player.name, jersey_number: player.jersey_number,
          preferred_groups: player.preferred_groups, availability: player.availability, gender: player.gender,
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
        events: (game.events || []).filter((item) => ["GOAL", "CARD", "SUBSTITUTION", "NOTE", "MATCH_ENDED"].includes(item.type)).slice(-30).map((item) => ({
          type: item.type, match_clock_ms: item.match_clock_ms,
          player_ids: item.player_ids, note: item.note?.slice(0, 160),
          data: item.data ? {
            team: item.data.team, scorer_id: item.data.scorer_id,
            assister_id: item.data.assister_id, player_in_id: item.data.player_in_id,
            player_out_id: item.data.player_out_id, player_id: item.data.player_id,
            color: item.data.color, is_own_goal: item.data.is_own_goal,
          } : undefined,
        })),
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await fetch("/api/match-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question: prompt, context }), signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!(response.headers.get("content-type") || "").includes("application/json")) {
        throw new Error("The match assistant API is unavailable. Run `npx vercel dev` and open the URL it prints.");
      }
      const result = await response.json();
      if (response.status === 405 && !result.error) {
        throw new Error("This server does not serve the match assistant API. Run `npx vercel dev` and open the URL it prints.");
      }
      if (!response.ok) throw new Error(result.error || `The match assistant returned HTTP ${response.status}.`);
      setAnswer(result.answer);
      if (onAcceptSubstitution && result.substitution) setSuggestion({ ...result.substitution, match_id: game.id });
    } catch (err) {
      setError(err.name === "AbortError" ? "The assistant took too long. Please try again." : (err.message || "The assistant could not answer."));
    } finally {
      setBusy(false);
    }
  }

  return <section className="match-assistant" aria-label="Match assistant">
    <h2>Ask TeamTrack</h2>
    <p>{onAcceptSubstitution
      ? "Ask about this match, player time, recorded events, or who to sub in. Substitutions require your approval."
      : "Ask about this match, player time, or recorded events."}</p>
    <form onSubmit={ask}>
      <label htmlFor="match-assistant-question">Your question</label>
      <textarea id="match-assistant-question" rows="2" maxLength="500" value={question}
        onChange={(event) => setQuestion(event.target.value)} placeholder={onAcceptSubstitution ? "Who should I sub in?" : "Summarize this match"} />
      <button className="button primary" type="submit" disabled={busy || !question.trim()}>{busy ? "Thinking…" : "Ask"}</button>
    </form>
    {error && <p role="alert" className="match-assistant-error">{error}</p>}
    {answer && <div className="match-assistant-answer" aria-live="polite">{answer}</div>}
    {suggestion && <div className="match-assistant-dialog-backdrop"><div className="match-assistant-dialog" role="dialog" aria-modal="true" aria-label="Suggested substitution">
      <h3>Suggested substitution</h3>
      <p>Sub in <strong>{incoming?.name || "Unknown player"}</strong> for <strong>{outgoing?.name || "Unknown player"}</strong>?</p>
      {answer && <p>{answer}</p>}
      {!suggestionCurrent && <p role="alert">The lineup changed or the field is locked. Ask again for a current suggestion.</p>}
      <div className="match-assistant-dialog-actions">
        <button ref={acceptButton} className="button primary" type="button" disabled={!suggestionCurrent} onClick={acceptSuggestion}>Accept substitution</button>
        <button ref={dismissButton} className="button secondary" type="button" onClick={() => setSuggestion(null)}>Dismiss</button>
      </div>
    </div></div>}
  </section>;
}
