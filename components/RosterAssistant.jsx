import React, { useEffect, useRef, useState } from "react";
import { getAccessToken } from "../state/cloud.js";

function isPlayerStatsQuestion(question) {
  return /\b(?:how many|stats|statistics|per game|playing time|minutes?|show me|tell me|what are|what is)\b/i.test(question) ||
    (/\b(?:goals|assists)\b/i.test(question) && !/\b(?:scored?|record|add|log|mark)\b/i.test(question));
}

export function RosterAssistant({ team, roster, matches, onAddPlayers }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [micSupported, setMicSupported] = useState(false);
  const [micStarting, setMicStarting] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recording = useRef(null);
  const starting = useRef(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setMicSupported(Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia));
    return () => { mounted.current = false; stopRecording(true); };
  }, []);

  async function ask(value) {
    const prompt = value.trim();
    if (!prompt || busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(""); setAnswer(""); setSuggestions([]);
    try {
      const token = await getAccessToken();
      const asksStats = isPlayerStatsQuestion(prompt);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await fetch("/api/roster-assistant", {
          method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question: prompt, teamId: team.id, coed: team.coed,
            roster: roster.map((player) => ({ id: player.id, name: player.name })), matches: asksStats ? matches : [] }),
        });
      } finally { clearTimeout(timer); }
      if (!(response.headers.get("content-type") || "").includes("application/json")) {
        throw new Error("The roster assistant API is unavailable on this deployment.");
      }
      const result = await response.json();
      if (!mounted.current) return;
      if (!response.ok) throw new Error(result.error || "The roster assistant could not answer.");
      if (result.mode === "add" && result.players?.length) {
        const saved = onAddPlayers(result.players);
        if (saved.error) throw new Error(saved.error);
        setAnswer(`${saved.added} player${saved.added === 1 ? "" : "s"} added as midfielders. Edit their positions as needed.` +
          (saved.skipped.length ? ` Already on the roster: ${saved.skipped.join(", ")}.` : "") +
          (team.coed ? " Set gender for new players before using them in coed lineups." : ""));
        setQuestion("");
      } else if (result.mode === "generate" && result.players?.length) {
        setAnswer(result.answer);
        setSuggestions(result.players);
      } else setAnswer(result.answer || "I could not answer that request.");
    } catch (err) {
      setError(err.name === "AbortError" ? "The roster assistant took too long. Try again." : err.message);
    } finally { busyRef.current = false; setBusy(false); }
  }

  function addGenerated() {
    const saved = onAddPlayers(suggestions);
    if (saved.error) { setError(saved.error); return; }
    setSuggestions([]); setQuestion(""); setError("");
    setAnswer(`${saved.added} sample player${saved.added === 1 ? "" : "s"} added to the roster.` +
      (saved.skipped.length ? ` Already present: ${saved.skipped.join(", ")}.` : ""));
  }

  function stopRecording(cancel = false) {
    if (starting.current) {
      starting.current.cancelled = true;
      starting.current.audioContext?.close().catch(() => {});
      starting.current = null;
    }
    const active = recording.current;
    if (!active) { setMicStarting(false); return; }
    active.cancelled = cancel;
    clearTimeout(active.timer); clearTimeout(active.readyTimer); clearInterval(active.silenceTimer);
    active.audioContext?.close().catch(() => {});
    recording.current = null; setMicStarting(false); setListening(false);
    if (active.recorder.state !== "inactive") active.recorder.stop();
    else active.stream.getTracks().forEach((track) => track.stop());
  }

  async function transcribe(blob) {
    if (!blob.size || blob.size > 1_500_000) throw new Error("Audio clip is too large or empty. Try a shorter request.");
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
        body: JSON.stringify({ teamId: team.id, purpose: "roster", audio: btoa(binary), mimeType: blob.type,
          playerNames: roster.map((player) => player.name).slice(0, 80) }),
      });
    } finally { clearTimeout(timer); }
    if (!(response.headers.get("content-type") || "").includes("application/json")) throw new Error("Voice transcription is unavailable.");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not transcribe your request.");
    const transcript = result.transcript?.trim();
    if (!transcript) throw new Error("No speech was recognized. Try again.");
    setQuestion(transcript);
    await ask(transcript);
  }

  function watchSpeech(active) {
    const context = active.audioContext;
    if (!context) return;
    try {
      const source = context.createMediaStreamSource(active.stream);
      const analyser = context.createAnalyser(); analyser.fftSize = 1024;
      const mute = context.createGain(); mute.gain.value = 0;
      source.connect(analyser); analyser.connect(mute); mute.connect(context.destination);
      const samples = new Float32Array(analyser.fftSize);
      let noiseFloor = 0.04; let loudFrames = 0; let heardSpeech = false; let lastSpeechAt = 0;
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
        if (heardSpeech && !speaking && now - lastSpeechAt >= 1300 && now - active.startedAt >= 1700) stopRecording();
      }, 80);
    } catch { context.close().catch(() => {}); }
  }

  async function startRecording() {
    if (!micSupported || recording.current || starting.current || busyRef.current || transcribing) return;
    const pending = { cancelled: false };
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      try { pending.audioContext = new AudioContext(); pending.audioContext.resume().catch(() => {}); }
      catch { pending.audioContext = null; }
    }
    starting.current = pending; setMicStarting(true); setError("");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (pending.cancelled || starting.current !== pending) {
        pending.audioContext?.close().catch(() => {});
        stream.getTracks().forEach((track) => track.stop()); return;
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
        active.ready = true; clearTimeout(active.readyTimer); setMicStarting(false); setListening(true);
      };
      recorder.ondataavailable = (event) => { if (event.data.size) { active.chunks.push(event.data); markReady(); } };
      recorder.onerror = () => { active.cancelled = true; setError("Could not record audio. Try again."); stopRecording(true); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (active.cancelled) return;
        if (performance.now() - active.startedAt < 600) { setError("Recording was too short. Try again."); return; }
        setTranscribing(true);
        try { await transcribe(new Blob(active.chunks, { type: recorder.mimeType })); }
        catch (error) { setError(error.name === "AbortError" ? "Voice transcription timed out. Try again." : error.message); }
        finally { setTranscribing(false); }
      };
      recorder.start(250); active.startedAt = performance.now(); watchSpeech(active);
      starting.current = null;
      active.readyTimer = setTimeout(markReady, 900);
      active.timer = setTimeout(() => stopRecording(), 8000);
    } catch (error) {
      if (starting.current === pending) starting.current = null;
      if (recording.current?.stream === stream) recording.current = null;
      pending.audioContext?.close().catch(() => {});
      setMicStarting(false); stream?.getTracks().forEach((track) => track.stop());
      setError(error.name === "NotAllowedError" ? "Allow microphone access to use voice input." : error.message || "Could not start the microphone.");
    }
  }

  return <section className="match-assistant roster-assistant" aria-label="Roster assistant">
    <h2>Ask TeamTrack</h2>
    <p>Generate a sample roster, add players by name, or ask about goals, assists, and minutes from match history.</p>
    <form onSubmit={(event) => { event.preventDefault(); ask(question); }}>
      <label htmlFor="roster-assistant-question">Your question</label>
      <div className="match-assistant-input">
        <textarea id="roster-assistant-question" rows="2" maxLength="500" value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(question); } }}
          placeholder="Auto generate me a roster" />
        {micSupported && <button className={`match-assistant-mic${listening ? " listening" : micStarting ? " starting" : ""}`} type="button"
          aria-label={listening ? "Stop recording" : micStarting ? "Cancel microphone startup" : transcribing ? "Transcribing" : "Record a voice request"}
          aria-pressed={listening || micStarting} title={listening ? "Stop recording" : micStarting ? "Starting microphone" : "Record a voice request"}
          disabled={(busy || transcribing) && !listening && !micStarting}
          onClick={() => recording.current ? stopRecording() : starting.current ? stopRecording(true) : startRecording()}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/></svg>
        </button>}
      </div>
      <button className="button primary" type="submit" disabled={busy || transcribing || !question.trim()}>{transcribing ? "Transcribing…" : busy ? "Thinking…" : "Ask"}</button>
    </form>
    {micStarting && <p role="status">Starting microphone… wait until it turns red before speaking.</p>}
    {listening && <p role="status">Recording… speak now. It stops after you finish, or tap the microphone to stop.</p>}
    {error && <p role="alert" className="match-assistant-error">{error}</p>}
    {answer && <div className="match-assistant-answer" aria-live="polite">{answer}</div>}
    {suggestions.length > 0 && <div className="match-assistant-dialog-backdrop"><div className="match-assistant-dialog" role="dialog" aria-modal="true" aria-label="Review generated roster">
      <h3>Review sample roster</h3>
      <p>These are fictional sample players. Add them to {team.name}?</p>
      <ul className="roster-assistant-suggestions">{suggestions.map((player) => <li key={player.name}><strong>{player.name}</strong><span>{player.preferred_groups.join(", ")}{team.coed ? ` · ${player.gender}` : ""}</span></li>)}</ul>
      {error && <p role="alert" className="match-assistant-error">{error}</p>}
      <div className="match-assistant-dialog-actions"><button className="button primary" type="button" onClick={addGenerated}>Add {suggestions.length} players</button><button className="button secondary" type="button" onClick={() => setSuggestions([])}>Cancel</button></div>
    </div></div>}
  </section>;
}
