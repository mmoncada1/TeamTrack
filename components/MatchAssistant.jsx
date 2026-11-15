import React, { useEffect, useRef, useState } from "react";
import { getAccessToken } from "../state/cloud.js";

function CountdownNotice({ seconds, action }) {
  return <div className="match-assistant-countdown" role="timer" aria-live="off">
    <strong aria-label={`${seconds} seconds remaining`}>{seconds}</strong>
    <span>seconds until {action}. Choose an option before the timer ends.</span>
  </div>;
}

export function MatchAssistant({ game, players, summary, derived, team, queuedSubs = [], onQueueSubstitutions, onApplyQueuedSubstitutions, onAcceptSubstitutions, onAcceptGoal, onAcceptMatchAction, onUndoEvent, onMoveRecordedSubsToQueue, fieldLocked = false }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [micStarting, setMicStarting] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [queueRequested, setQueueRequested] = useState(false);
  const [goalProposal, setGoalProposal] = useState(null);
  const [matchAction, setMatchAction] = useState(null);
  const [undoProposal, setUndoProposal] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [countdown, setCountdown] = useState(null);
  const dialog = useRef(null);
  const recording = useRef(null);
  const startingRecording = useRef(null);
  const busyRef = useRef(false);
  const acceptLatest = useRef(null);
  acceptLatest.current = () => {
    if (proposals.length) { if (queueRequested) queueProposals(proposals, true); else acceptProposals(proposals, true); }
    else if (goalProposal) acceptGoal(true);
    else if (matchAction) acceptMatchAction(true);
    else if (undoProposal) acceptUndo(true);
  };

  useEffect(() => {
    setSpeechSupported(Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia));
    return () => {
      window.speechSynthesis?.cancel();
      stopRecording(true);
    };
  }, []);

  useEffect(() => {
    if (!proposals.length && !goalProposal && !matchAction && !undoProposal) { setCountdown(null); return; }
    const seconds = Math.max(1, Math.floor(Number(game.settings?.assistant_accept_seconds) || 5));
    const deadline = Date.now() + seconds * 1000;
    setCountdown(seconds);
    const interval = setInterval(() => setCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 200);
    const timeout = setTimeout(() => acceptLatest.current?.(), seconds * 1000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [proposals, goalProposal, matchAction, undoProposal, game.settings?.assistant_accept_seconds]);

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

  function acceptProposals(selected, fromTimer = false) {
    if (!onAcceptSubstitutions || !selected.length || !selected.every((item) => proposalCurrent(item))) {
      setDialogError("The lineup changed or the field is locked. Review the swaps and try again.");
      return;
    }
    setDialogError("");
    try {
      const error = onAcceptSubstitutions(selected);
      if (error) setDialogError(error);
      else {
        setProposals((current) => current.filter((item) => !selected.includes(item)));
        if (fromTimer && selected.length === proposals.length) setQuestion("");
        setAnswer(`${selected.length} substitution${selected.length === 1 ? "" : "s"} recorded.`);
      }
    } catch (err) {
      setDialogError(err.message || "Could not make those substitutions.");
    }
  }

  function queueProposals(selected, fromTimer = false) {
    if (!onQueueSubstitutions || !selected.length || !selected.every((item) => proposalCurrent(item, false))) return;
    const result = onQueueSubstitutions(selected);
    if (result) setDialogError(result);
    else { setProposals((current) => current.filter((item) => !selected.includes(item))); if (fromTimer && selected.length === proposals.length) setQuestion(""); setDialogError(""); setAnswer(`${selected.length} substitution${selected.length === 1 ? "" : "s"} queued. Apply them when they happen.`); }
  }

  function goalCurrent() {
    return goalProposal?.match_id === game.id && derived.status !== "ended" &&
      goalProposal.team_score === summary.team_score && goalProposal.opponent_score === summary.opponent_score &&
      (goalProposal.team !== "us" || (derived.player_states?.[goalProposal.scorer_id]?.status === "field" &&
        (!goalProposal.assister_id || derived.player_states?.[goalProposal.assister_id]?.status === "field")));
  }

  function acceptGoal(fromTimer = false) {
    if (!goalCurrent() || !onAcceptGoal) { setDialogError("The score or lineup changed. Ask again before recording this goal."); return; }
    try {
      const result = onAcceptGoal(goalProposal);
      if (result) setDialogError(result); else { setGoalProposal(null); if (fromTimer === true) setQuestion(""); setDialogError(""); }
    } catch (error) { setDialogError(error.message || "Could not record the goal."); }
  }

  function actionCurrent() {
    return matchAction?.match_id === game.id && derived.status !== "ended" &&
      derived.player_states?.[matchAction.player_id]?.status !== "unavailable";
  }

  function acceptMatchAction(fromTimer = false) {
    if (!actionCurrent() || !onAcceptMatchAction) { setDialogError("The match or player status changed. Ask again before recording this action."); return; }
    try {
      const result = onAcceptMatchAction(matchAction);
      if (result) setDialogError(result); else { setMatchAction(null); if (fromTimer === true) setQuestion(""); setDialogError(""); }
    } catch (error) { setDialogError(error.message || "Could not record the action."); }
  }

  function acceptUndo(fromTimer = false) {
    const latest = game.events?.filter((event) => event.type === undoProposal?.event_type).at(-1);
    const action = undoProposal?.mode === "queue" ? onMoveRecordedSubsToQueue : onUndoEvent;
    if (!action || !latest || latest.id !== undoProposal?.event_id) {
      setDialogError("The match history changed. Ask TeamTrack again.");
      return;
    }
    try {
      const result = action(undoProposal);
      if (result) setDialogError(result);
      else {
        setUndoProposal(null);
        setDialogError("");
        setAnswer(undoProposal.mode === "queue" ? `${undoProposal.event_ids.length} recorded substitution${undoProposal.event_ids.length === 1 ? "" : "s"} moved to the queue.` : `${undoProposal.description} undone.`);
        if (fromTimer === true) setQuestion("");
      }
    } catch (error) { setDialogError(error.message || "Could not undo that match event."); }
  }

  async function submitPrompt(value, fromVoice = false) {
    const prompt = value.trim();
    if (!prompt || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setAnswer("");
    setProposals([]);
    setQueueRequested(false);
    setGoalProposal(null);
    setMatchAction(null);
    setUndoProposal(null);
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
      const playerIds = new Set(derived.included_player_ids || game.roster_player_ids || []);
      const context = {
        team: team ? { coed: team.coed, min_girls_on_field: team.min_girls_on_field } : undefined,
        match: {
          id: game.id, team_id: game.team_id, team_name: game.team_name,
          opponent_name: game.opponent_name, date: game.date,
          status: derived.status, clock_ms: derived.display_clock_ms,
          remaining_ms: Math.max(0, (game.settings?.half_length_minutes || 0) * (game.settings?.number_of_halves || 0) * 60000 - derived.match_clock_ms),
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
          total_field_ms: item.total_field_ms,
        })),
        alerts: (game.active_alerts || []).filter((item) => item.status === "active").map((item) => ({
          player_id: item.player_id, position_group: item.position_group,
          threshold_minutes: item.threshold_minutes, recommendation: item.recommendation,
        })),
        events: (game.events || []).filter((item) => ["GOAL", "CARD", "SUBSTITUTION", "NOTE", "MATCH_ENDED"].includes(item.type))
          .filter((item, index, events) => item.type === "GOAL" || index >= events.length - 30).map((item) => ({
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
          body: JSON.stringify({ question: prompt, context, fromVoice }), signal: controller.signal,
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
      if (fromVoice && result.interpretedQuestion) setQuestion(result.interpretedQuestion);
      setAnswer(result.answer);
      const suggestions = Array.isArray(result.substitutions)
        ? result.substitutions : result.substitution ? [result.substitution] : [];
      if (onAcceptSubstitutions) {
        const next = suggestions.map((item) => ({ ...item, match_id: game.id }));
        setQueueRequested(Boolean(next.length && onQueueSubstitutions &&
          /^\s*(?:please\s+)?(?:q|queue)\b/i.test(`${prompt} ${result.interpretedQuestion || ""}`)));
        setProposals(next);
      }
      if (onAcceptGoal && result.goal) setGoalProposal({ ...result.goal, match_id: game.id,
        team_score: summary.team_score, opponent_score: summary.opponent_score });
      if (onAcceptMatchAction && result.matchAction) setMatchAction({ ...result.matchAction, match_id: game.id });
      if (result.undo) {
        if (!onUndoEvent) setAnswer("Open the live match page to undo a recorded event.");
        else {
          const event = game.events?.filter((item) => item.type === result.undo.event_type).at(-1);
          if (!event) setAnswer("No matching recorded event was found to undo.");
          else {
            const name = (id) => players.find((player) => player.id === id)?.name || "Unknown player";
            const description = event.type === "GOAL" ? `Goal by ${event.data?.scorer_id ? name(event.data.scorer_id) : event.data?.team === "opponent" ? game.opponent_name : game.team_name}` :
              event.type === "SUBSTITUTION" ? `Substitution: ${name(event.data?.player_in_id)} for ${name(event.data?.player_out_id)}` :
              event.type === "CARD" ? `${event.data?.color || ""} card for ${name(event.data?.player_id)}` :
              `Injury for ${name(event.data?.player_id)}`;
            setUndoProposal({ match_id: game.id, event_id: event.id, event_type: event.type, description });
          }
        }
      }
      if (result.moveToQueue) {
        if (!onMoveRecordedSubsToQueue) setAnswer("Open the live match page to move recorded substitutions to the queue.");
        else {
          const subs = game.events?.filter((item) => item.type === "SUBSTITUTION") || [];
          const latest = subs.at(-1);
          const batch = latest ? subs.filter((item) => item.timestamp === latest.timestamp) : [];
          const count = result.moveToQueue.count || batch.length;
          if (!latest) setAnswer("There are no recorded substitutions to move to the queue.");
          else if (count > batch.length) setAnswer(`The latest recorded batch contains only ${batch.length} substitution${batch.length === 1 ? "" : "s"}.`);
          else {
            const selected = batch.slice(-count);
            const name = (id) => players.find((player) => player.id === id)?.name || "Unknown player";
            const description = selected.map((item) => `${name(item.data?.player_in_id)} for ${name(item.data?.player_out_id)}`).join(", ");
            setUndoProposal({ mode: "queue", match_id: game.id, event_id: latest.id, event_type: "SUBSTITUTION",
              event_ids: selected.map((item) => item.id), description });
          }
        }
      }
    } catch (err) {
      setError(err.name === "AbortError" ? "The assistant took too long. Please try again." : (err.message || "The assistant could not answer."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function ask(event) {
    event.preventDefault();
    submitPrompt(question);
  }

  function stopRecording(cancel = false) {
    if (startingRecording.current) {
      startingRecording.current.cancelled = true;
      startingRecording.current.audioContext?.close().catch(() => {});
      startingRecording.current = null;
    }
    const active = recording.current;
    if (!active) {
      setMicStarting(false);
      return;
    }
    active.cancelled = cancel;
    clearTimeout(active.timer);
    clearTimeout(active.readyTimer);
    clearInterval(active.silenceTimer);
    active.audioContext?.close().catch(() => {});
    recording.current = null;
    setMicStarting(false);
    setListening(false);
    if (active.recorder.state !== "inactive") active.recorder.stop();
    else active.stream.getTracks().forEach((track) => track.stop());
  }

  async function transcribeAudio(blob) {
    if (!blob.size || blob.size > 1_500_000) throw new Error("Audio clip is too large or empty. Try a shorter command.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    }
    const token = await getAccessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28000);
    let response;
    try {
      response = await fetch("/api/match-transcribe", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teamId: game.team_id, audio: btoa(binary), mimeType: blob.type,
          playerNames: players.filter((player) => player.team_id === game.team_id).map((player) => player.name).slice(0, 80) }),
      });
    } finally { clearTimeout(timer); }
    if (!(response.headers.get("content-type") || "").includes("application/json")) {
      throw new Error("Voice transcription API is unavailable. Check this deployment or use the text box.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not transcribe your voice command.");
    const transcript = result.transcript?.trim();
    if (!transcript) throw new Error("No speech was recognized. Try again.");
    setQuestion(transcript);
    submitPrompt(transcript, true);
  }

  function watchForEndOfSpeech(active) {
    const context = active.audioContext;
    if (!context) return;
    try {
      const source = context.createMediaStreamSource(active.stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      const mute = context.createGain();
      mute.gain.value = 0;
      source.connect(analyser);
      analyser.connect(mute);
      mute.connect(context.destination);
      const samples = new Float32Array(analyser.fftSize);
      let noiseFloor = 0.04;
      let loudFrames = 0;
      let heardSpeech = false;
      let lastSpeechAt = 0;
      active.silenceTimer = setInterval(() => {
        if (recording.current !== active || context.state !== "running") return;
        analyser.getFloatTimeDomainData(samples);
        let power = 0;
        for (const sample of samples) power += sample * sample;
        const level = Math.sqrt(power / samples.length);
        const now = performance.now();
        if (now - active.startedAt < 400) noiseFloor = Math.min(noiseFloor, level);
        const speaking = level > Math.max(0.015, noiseFloor * 2.5);
        loudFrames = speaking ? loudFrames + 1 : 0;
        if (loudFrames >= 2) { heardSpeech = true; lastSpeechAt = now; }
        if (heardSpeech && !speaking && now - lastSpeechAt >= 1300 && now - active.startedAt >= 1700) {
          stopRecording();
        }
      }, 80);
    } catch {
      active.audioContext?.close().catch(() => {});
    }
  }

  async function startRecording() {
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia || recording.current ||
        startingRecording.current || transcribing || busyRef.current) return;
    const pending = { cancelled: false };
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      try {
        pending.audioContext = new AudioContext();
        pending.audioContext.resume().catch(() => {});
      } catch { pending.audioContext = null; }
    }
    startingRecording.current = pending;
    setMicStarting(true);
    const report = setError;
    report("");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (pending.cancelled || startingRecording.current !== pending) {
        pending.audioContext?.close().catch(() => {});
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
        .find((type) => window.MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("This browser cannot record a supported audio format.");
      const recorder = new window.MediaRecorder(stream, { mimeType });
      const active = { recorder, stream, chunks: [], cancelled: false, timer: null, readyTimer: null,
        silenceTimer: null, audioContext: pending.audioContext, startedAt: 0, ready: false };
      recording.current = active;
      const markReady = () => {
        if (active.ready || active.cancelled || recording.current !== active) return;
        active.ready = true;
        clearTimeout(active.readyTimer);
        setMicStarting(false);
        setListening(true);
      };
      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          active.chunks.push(event.data);
          markReady();
        }
      };
      recorder.onerror = () => { active.cancelled = true; report("Could not record audio. Try again."); stopRecording(true); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (active.cancelled) return;
        if (performance.now() - active.startedAt < 600) {
          report("Recording was too short. Speak after the microphone turns red, then tap to stop.");
          return;
        }
        setTranscribing(true);
        try { await transcribeAudio(new Blob(active.chunks, { type: recorder.mimeType })); }
        catch (error) { report(error.name === "AbortError" ? "Voice transcription timed out. Try again." : error.message); }
        finally { setTranscribing(false); }
      };
      recorder.start(250);
      active.startedAt = performance.now();
      watchForEndOfSpeech(active);
      startingRecording.current = null;
      // Some browsers delay periodic chunks. Keep the first 900 ms as pre-roll
      // before showing the red, ready-to-speak indicator.
      active.readyTimer = setTimeout(markReady, 900);
      active.timer = setTimeout(() => stopRecording(), 8000);
    } catch (error) {
      if (startingRecording.current === pending) startingRecording.current = null;
      if (recording.current?.stream === stream) recording.current = null;
      pending.audioContext?.close().catch(() => {});
      setMicStarting(false);
      stream?.getTracks().forEach((track) => track.stop());
      report(error.name === "NotAllowedError" ? "Allow microphone access to use voice input." : error.message || "Could not start the microphone.");
    }
  }

  function toggleMicrophone() {
    if (recording.current) stopRecording(micStarting);
    else if (startingRecording.current) stopRecording(true);
    else startRecording();
  }

  return <section className="match-assistant" aria-label="Match assistant">
    <h2>Ask TeamTrack</h2>
    <p>{onAcceptSubstitutions
      ? "Ask about this match, substitutions, goals, cards, or injuries. Queue swaps for later or record them when they happen."
      : "Ask about this match, player time, or recorded events."}</p>
    <form onSubmit={ask}>
      <label htmlFor="match-assistant-question">Your question</label>
      <div className="match-assistant-input">
        <textarea id="match-assistant-question" rows="2" maxLength="500" value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submitPrompt(question); } }}
          placeholder={onAcceptSubstitutions ? "Make 3 best subs" : "Summarize this match"} />
        {speechSupported && <button className={`match-assistant-mic${listening ? " listening" : micStarting ? " starting" : ""}`} type="button"
          aria-label={listening ? "Stop recording" : micStarting ? "Cancel microphone startup" : transcribing ? "Transcribing" : "Record a voice command"} aria-pressed={listening || micStarting}
          title={listening ? "Stop recording" : micStarting ? "Starting microphone" : "Record a voice command"} onClick={() => toggleMicrophone()} disabled={(busy || transcribing) && !listening && !micStarting}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/></svg>
        </button>}
      </div>
      <button className="button primary" type="submit" disabled={busy || transcribing || !question.trim()}>{transcribing ? "Transcribing…" : busy ? "Thinking…" : "Ask"}</button>
    </form>
    {micStarting && <p role="status">Starting microphone… wait until it turns red before speaking.</p>}
    {listening && <p role="status">Recording… speak now. It stops after you finish, or tap the microphone to stop.</p>}
    {error && <p role="alert" className="match-assistant-error">{error}</p>}
    {answer && <div className="match-assistant-answer" aria-live="polite">{answer}</div>}
    {undoProposal && <div className="match-assistant-dialog-backdrop"><div className="match-assistant-dialog" role="dialog" aria-modal="true" aria-label="Review undo">
      <h3>{undoProposal.mode === "queue" ? "Move recorded substitutions to queue?" : "Undo recorded change?"}</h3>
      <p>{undoProposal.description}</p>
      <CountdownNotice seconds={countdown ?? (game.settings?.assistant_accept_seconds || 5)} action={undoProposal.mode === "queue" ? "moving these substitutions to the queue" : "undoing this change"} />
      {dialogError && <p role="alert" className="match-assistant-error">{dialogError}</p>}
      <div className="match-assistant-dialog-actions">
        <button className="button primary" type="button" onClick={() => acceptUndo()}>{undoProposal.mode === "queue" ? "Move to queue" : "Undo change"}</button>
        <button className="button secondary" type="button" onClick={() => { setUndoProposal(null); setDialogError(""); }}>Keep change</button>
      </div>
    </div></div>}
    {matchAction && <div className="match-assistant-dialog-backdrop"><div className="match-assistant-dialog" role="dialog" aria-modal="true" aria-label="Review match action">
      <h3>Review match action</h3>
      <p>{players.find((player) => player.id === matchAction.player_id)?.name || "Unknown player"}: {matchAction.type === "card" ? `${matchAction.color} card` : "mark injured"}</p>
      <CountdownNotice seconds={countdown ?? (game.settings?.assistant_accept_seconds || 5)} action="recording this action" />
      {dialogError && <p role="alert" className="match-assistant-error">{dialogError}</p>}
      <div className="match-assistant-dialog-actions">
        <button className="button primary" type="button" disabled={!actionCurrent()} onClick={acceptMatchAction}>Record action</button>
        <button className="button secondary" type="button" onClick={() => { setMatchAction(null); setDialogError(""); }}>Reject</button>
      </div>
    </div></div>}
    {goalProposal && <div className="match-assistant-dialog-backdrop"><div className="match-assistant-dialog" role="dialog" aria-modal="true" aria-label="Review proposed goal">
      <h3>Review goal</h3>
      <p>{goalProposal.team === "opponent" ? `${game.opponent_name} scored` : `${players.find((player) => player.id === goalProposal.scorer_id)?.name || "Unknown player"} scored`}
        {goalProposal.assister_id ? ` · Assisted by ${players.find((player) => player.id === goalProposal.assister_id)?.name || "Unknown player"}` : ""}</p>
      <p>Score: {summary.team_score}–{summary.opponent_score} → {summary.team_score + (goalProposal.team === "us" ? 1 : 0)}–{summary.opponent_score + (goalProposal.team === "opponent" ? 1 : 0)}</p>
      <CountdownNotice seconds={countdown ?? (game.settings?.assistant_accept_seconds || 5)} action="recording this goal" />
      {(goalProposal.team_score !== summary.team_score || goalProposal.opponent_score !== summary.opponent_score) &&
        <p className="match-assistant-stale">The score changed. Ask again before recording this goal.</p>}
      {goalProposal.team === "us" && (derived.player_states?.[goalProposal.scorer_id]?.status !== "field" ||
        (goalProposal.assister_id && derived.player_states?.[goalProposal.assister_id]?.status !== "field")) &&
        <p className="match-assistant-stale">The lineup changed. Ask again before recording this goal.</p>}
      {dialogError && <p role="alert" className="match-assistant-error">{dialogError}</p>}
      <div className="match-assistant-dialog-actions">
        <button className="button primary" type="button" disabled={!goalCurrent()} onClick={acceptGoal}>Record goal</button>
        <button className="button secondary" type="button" onClick={() => { setGoalProposal(null); setDialogError(""); }}>Reject</button>
      </div>
    </div></div>}
    {proposals.length > 0 && <div className="match-assistant-dialog-backdrop"><div ref={dialog} className="match-assistant-dialog" role="dialog" aria-modal="true" aria-label="Suggested substitutions">
      <h3>Suggested substitutions</h3>
      <CountdownNotice seconds={countdown ?? (game.settings?.assistant_accept_seconds || 5)} action={queueRequested ? `queueing ${proposals.length === 1 ? "this substitution" : "these substitutions"}` : `recording ${proposals.length === 1 ? "this substitution" : "these substitutions"}`} />
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
            <button className="button primary" type="button" disabled={queueRequested ? !proposalCurrent(proposal, false) : !current} onClick={() => queueRequested ? queueProposals([proposal]) : acceptProposals([proposal])}>{queueRequested ? "Accept and queue" : "Accept"}</button>
            {!queueRequested && onQueueSubstitutions && <button className="button secondary" type="button" disabled={!proposalCurrent(proposal, false)} onClick={() => queueProposals([proposal])}>Queue for later</button>}
            <button className="button secondary" type="button" onClick={() => setProposals((items) => items.filter((item) => item !== proposal))}>Reject</button>
          </div>
        </li>;
      })}</ol>
      {dialogError && <p role="alert" className="match-assistant-error">{dialogError}</p>}
      <div className="match-assistant-dialog-actions">
        {proposals.length > 1 && <button className="button primary" type="button" disabled={!proposals.every((item) => proposalCurrent(item, !queueRequested))} onClick={() => queueRequested ? queueProposals(proposals) : acceptProposals(proposals)}>{queueRequested ? "Accept and queue all" : "Accept all"} {proposals.length}</button>}
        {proposals.length > 1 && !queueRequested && onQueueSubstitutions && <button className="button secondary" type="button" disabled={!proposals.every((item) => proposalCurrent(item, false))} onClick={() => queueProposals(proposals)}>Queue all {proposals.length}</button>}
        <button className="button secondary" type="button" onClick={() => setProposals([])}>Reject all</button>
      </div>
    </div></div>}
  </section>;
}
