import React, { useEffect, useRef, useState } from "react";
import { getAccessToken } from "../state/cloud.js";

export function MatchAssistant({ game, players, summary, derived, team, queuedSubs = [], onQueueSubstitutions, onApplyQueuedSubstitutions, onAcceptSubstitutions, onAcceptGoal, onAcceptMatchAction, fieldLocked = false }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [goalProposal, setGoalProposal] = useState(null);
  const [matchAction, setMatchAction] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const dialog = useRef(null);
  const dismissButton = useRef(null);

  useEffect(() => {
    if (!proposals.length) return;
    const previousFocus = document.activeElement;
    dialog.current?.querySelector("button:not(:disabled)")?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") setProposals([]);
      if (event.key === "Tab") {
        const buttons = [...(dialog.current?.querySelectorAll("button:not(:disabled)") || [])];
        const first = buttons[0];
        const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [Boolean(proposals.length)]);

  function proposalCurrent(proposal, requireUnlocked = true) {
    return proposal.match_id === game.id &&
      players.some((player) => player.id === proposal.incoming_player_id) &&
      players.some((player) => player.id === proposal.outgoing_player_id) &&
      derived.player_states?.[proposal.incoming_player_id]?.status === "bench" &&
      derived.player_states?.[proposal.outgoing_player_id]?.status === "field" &&
      derived.player_states?.[proposal.outgoing_player_id]?.position_id === proposal.position_id &&
      derived.assignments?.[proposal.position_id] === proposal.outgoing_player_id &&
      (!requireUnlocked || !fieldLocked) && !["setup", "ended"].includes(derived.status);
  }

  function acceptProposals(selected) {
    if (!onAcceptSubstitutions || !selected.length || !selected.every(proposalCurrent)) return;
    setDialogError("");
    try {
      const error = onAcceptSubstitutions(selected);
      if (error) setDialogError(error);
      else setProposals((current) => current.filter((item) => !selected.includes(item)));
    } catch (err) {
      setDialogError(err.message || "Could not make those substitutions.");
    }
  }

  function queueProposals(selected) {
    if (!onQueueSubstitutions || !selected.length || !selected.every((item) => proposalCurrent(item, false))) return;
    const result = onQueueSubstitutions(selected);
    if (result) setDialogError(result);
    else { setProposals((current) => current.filter((item) => !selected.includes(item))); setDialogError(""); setAnswer(`${selected.length} substitution${selected.length === 1 ? "" : "s"} queued. Apply them when they happen.`); }
  }

  async function ask(event) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    setProposals([]);
    setGoalProposal(null);
    setMatchAction(null);
    setDialogError("");
    try {
      if (/\b(?:push|apply|record|make)\s+(?:this\s+|the\s+|next\s+|queued\s+|all\s+)*(?:subs?|substitutions?|swaps?)\b/i.test(prompt) && onApplyQueuedSubstitutions) {
        if (!queuedSubs.length) { setAnswer("There are no queued substitutions to apply."); return; }
        const all = /\ball\b/i.test(prompt);
        const selected = all ? queuedSubs : queuedSubs.slice(0, 1);
        const result = onApplyQueuedSubstitutions(selected);
        setAnswer(result || `${selected.length} queued substitution${selected.length === 1 ? "" : "s"} recorded.`);
        return;
      }
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
        settings: { thresholds: game.settings?.thresholds, goalkeeper_rotation_enabled: game.settings?.goalkeeper_rotation_enabled },
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
        if (response.status >= 500) {
          throw new Error(`The match assistant server failed (HTTP ${response.status}). Check the Vercel function logs.`);
        }
        throw new Error(window.location.hostname === "localhost"
          ? "The match assistant API is unavailable. Run `npx vercel dev` and open the URL it prints."
          : `The match assistant API is unavailable on this deployment (HTTP ${response.status}).`);
      }
      const result = await response.json();
      if (response.status === 405 && !result.error) {
        throw new Error("This server does not serve the match assistant API. Run `npx vercel dev` and open the URL it prints.");
      }
      if (!response.ok) throw new Error(result.error || `The match assistant returned HTTP ${response.status}.`);
      setAnswer(result.answer);
      const suggestions = Array.isArray(result.substitutions)
        ? result.substitutions : result.substitution ? [result.substitution] : [];
      if (onAcceptSubstitutions) {
        const next = suggestions.map((item) => ({ ...item, match_id: game.id }));
        setProposals(next);
        if (/\bqueue\b/i.test(prompt) && next.length && onQueueSubstitutions) {
          const result = onQueueSubstitutions(next);
          if (result) setDialogError(result);
          else { setProposals([]); setAnswer(`${next.length} substitution${next.length === 1 ? "" : "s"} queued. Apply them when they happen.`); }
        }
      }
      if (onAcceptGoal && result.goal) setGoalProposal({ ...result.goal, match_id: game.id,
        team_score: summary.team_score, opponent_score: summary.opponent_score });
      if (onAcceptMatchAction && result.matchAction) setMatchAction({ ...result.matchAction, match_id: game.id });
    } catch (err) {
      setError(err.name === "AbortError" ? "The assistant took too long. Please try again." : (err.message || "The assistant could not answer."));
    } finally {
      setBusy(false);
    }
  }

  return <section className="match-assistant" aria-label="Match assistant">
    <h2>Ask TeamTrack</h2>
    <p>{onAcceptSubstitutions
      ? "Ask about this match, substitutions, goals, cards, or injuries. Queue swaps for later or record them when they happen."
      : "Ask about this match, player time, or recorded events."}</p>
    <form onSubmit={ask}>
      <label htmlFor="match-assistant-question">Your question</label>
      <textarea id="match-assistant-question" rows="2" maxLength="500" value={question}
        onChange={(event) => setQuestion(event.target.value)} placeholder={onAcceptSubstitutions ? "Make 3 best subs" : "Summarize this match"} />
      <button className="button primary" type="submit" disabled={busy || !question.trim()}>{busy ? "Thinking…" : "Ask"}</button>
    </form>
    {error && <p role="alert" className="match-assistant-error">{error}</p>}
    {answer && <div className="match-assistant-answer" aria-live="polite">{answer}</div>}
    {matchAction && <div className="match-assistant-dialog-backdrop"><div className="match-assistant-dialog" role="dialog" aria-modal="true" aria-label="Review match action">
      <h3>Review match action</h3>
      <p>{players.find((player) => player.id === matchAction.player_id)?.name || "Unknown player"}: {matchAction.type === "card" ? `${matchAction.color} card` : "mark injured"}</p>
      {dialogError && <p role="alert" className="match-assistant-error">{dialogError}</p>}
      <div className="match-assistant-dialog-actions">
        <button className="button primary" type="button" disabled={matchAction.match_id !== game.id || derived.status === "ended" ||
          derived.player_states?.[matchAction.player_id]?.status === "unavailable"} onClick={() => {
          const result = onAcceptMatchAction(matchAction);
          if (result) setDialogError(result); else { setMatchAction(null); setDialogError(""); }
        }}>Record action</button>
        <button className="button secondary" type="button" onClick={() => { setMatchAction(null); setDialogError(""); }}>Cancel</button>
      </div>
    </div></div>}
    {goalProposal && <div className="match-assistant-dialog-backdrop"><div className="match-assistant-dialog" role="dialog" aria-modal="true" aria-label="Review proposed goal">
      <h3>Review goal</h3>
      <p>{goalProposal.team === "opponent" ? `${game.opponent_name} scored` : `${players.find((player) => player.id === goalProposal.scorer_id)?.name || "Unknown player"} scored`}
        {goalProposal.assister_id ? ` · Assisted by ${players.find((player) => player.id === goalProposal.assister_id)?.name || "Unknown player"}` : ""}</p>
      <p>Score: {summary.team_score}–{summary.opponent_score} → {summary.team_score + (goalProposal.team === "us" ? 1 : 0)}–{summary.opponent_score + (goalProposal.team === "opponent" ? 1 : 0)}</p>
      {(goalProposal.team_score !== summary.team_score || goalProposal.opponent_score !== summary.opponent_score) &&
        <p className="match-assistant-stale">The score changed. Ask again before recording this goal.</p>}
      {dialogError && <p role="alert" className="match-assistant-error">{dialogError}</p>}
      <div className="match-assistant-dialog-actions">
        <button className="button primary" type="button" disabled={goalProposal.match_id !== game.id || derived.status === "ended" ||
          goalProposal.team_score !== summary.team_score || goalProposal.opponent_score !== summary.opponent_score} onClick={() => {
          const result = onAcceptGoal(goalProposal);
          if (result) setDialogError(result); else { setGoalProposal(null); setDialogError(""); }
        }}>Record goal</button>
        <button className="button secondary" type="button" onClick={() => { setGoalProposal(null); setDialogError(""); }}>Cancel</button>
      </div>
    </div></div>}
    {proposals.length > 0 && <div className="match-assistant-dialog-backdrop"><div ref={dialog} className="match-assistant-dialog" role="dialog" aria-modal="true" aria-label="Suggested substitutions">
      <h3>Suggested substitutions</h3>
      {answer && <p>{answer}</p>}
      <ol className="match-assistant-proposals">{proposals.map((proposal) => {
        const incoming = players.find((player) => player.id === proposal.incoming_player_id);
        const outgoing = players.find((player) => player.id === proposal.outgoing_player_id);
        const current = proposalCurrent(proposal);
        const fieldMs = derived.player_states?.[proposal.outgoing_player_id]?.current_stint_ms || 0;
        const benchMs = derived.player_states?.[proposal.incoming_player_id]?.current_stint_ms || 0;
        const minutes = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
        return <li key={`${proposal.outgoing_player_id}:${proposal.incoming_player_id}`}>
          <strong>Sub in {incoming?.name || "Unknown player"} for {outgoing?.name || "Unknown player"}</strong>
          <span className="match-assistant-stint">{outgoing?.name || "Outgoing player"} on field: {minutes(fieldMs)} · {incoming?.name || "Incoming player"} on bench: {minutes(benchMs)}</span>
          {!current && <span className="match-assistant-stale">Lineup changed or field locked. Ask again for this swap.</span>}
          <div className="match-assistant-dialog-actions">
            <button className="button primary" type="button" disabled={!current} onClick={() => acceptProposals([proposal])}>Accept</button>
            {onQueueSubstitutions && <button className="button secondary" type="button" disabled={!proposalCurrent(proposal, false)} onClick={() => queueProposals([proposal])}>Queue for later</button>}
            <button className="button secondary" type="button" onClick={() => setProposals((items) => items.filter((item) => item !== proposal))}>Skip</button>
          </div>
        </li>;
      })}</ol>
      {dialogError && <p role="alert" className="match-assistant-error">{dialogError}</p>}
      <div className="match-assistant-dialog-actions">
        {proposals.length > 1 && <button className="button primary" type="button" disabled={!proposals.every(proposalCurrent)} onClick={() => acceptProposals(proposals)}>Accept all {proposals.length}</button>}
        {proposals.length > 1 && onQueueSubstitutions && <button className="button secondary" type="button" disabled={!proposals.every((item) => proposalCurrent(item, false))} onClick={() => queueProposals(proposals)}>Queue all {proposals.length}</button>}
        <button ref={dismissButton} className="button secondary" type="button" onClick={() => setProposals([])}>Dismiss</button>
      </div>
    </div></div>}
  </section>;
}
