const SUPABASE_URL = "https://agtdyrerqbuwfwimbttj.supabase.co";
const SUPABASE_KEY = "sb_publishable_7Hc6x5-_JGvimNXl2iMcig_shCj4LMq";
const MAX_AUDIO_BYTES = 1_500_000;
const AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/ogg"]);

function send(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  const token = /^Bearer (\S+)$/.exec(req.headers.authorization || "")?.[1];
  if (!token) return send(res, 401, { error: "Please sign in." });
  const { teamId, audio, mimeType, playerNames } = req.body || {};
  const type = typeof mimeType === "string" ? mimeType.split(";")[0].toLowerCase() : "";
  if (typeof teamId !== "string" || !/^[0-9a-f-]{36}$/i.test(teamId) ||
      !AUDIO_TYPES.has(type) || typeof audio !== "string" || !audio ||
      audio.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(audio) ||
      Buffer.byteLength(audio, "base64") > MAX_AUDIO_BYTES ||
      !Array.isArray(playerNames) || playerNames.length > 80 ||
      playerNames.some((name) => typeof name !== "string" || name.length > 80)) {
    return send(res, 400, { error: "Invalid or oversized audio clip." });
  }
  try {
    const signal = AbortSignal.timeout(25000);
    const access = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=id&id=eq.${encodeURIComponent(teamId)}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }, signal,
    });
    if (access.status === 401 || access.status === 403) return send(res, 401, { error: "Please sign in again." });
    if (!access.ok) return send(res, 502, { error: "Could not verify team access." });
    const teams = await access.json();
    if (!Array.isArray(teams) || teams.length !== 1) return send(res, 403, { error: "This team is unavailable." });
    if (!process.env.GEMINI_API_KEY) return send(res, 503, { error: "Voice transcription is not configured yet." });
    const vocabulary = [...new Set([
      ...playerNames.map((name) => name.trim()).filter(Boolean),
      "soccer", "scored", "goal", "assist", "assisted by", "sub in", "sub out", "substitution", "yellow card", "red card",
    ])].slice(0, 100);
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent", {
      method: "POST", signal,
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ inlineData: { mimeType: type, data: audio } }] }],
        generationConfig: { audioTranscriptionConfig: { languageCodes: ["en-US"], customVocabulary: vocabulary } },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Gemini transcription failed", { status: response.status, code: result.error?.code });
      if (response.status === 429) return send(res, 503, { error: "Voice transcription quota reached. Try again later." });
      if ([400, 404].includes(response.status)) return send(res, 502, { error: "Voice transcription rejected the audio format or model. Check the server configuration." });
      return send(res, 502, { error: "Voice transcription is unavailable. Try again shortly." });
    }
    const transcript = (result.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "").join(" ").trim().slice(0, 500);
    if (!transcript) return send(res, 422, { error: "No speech was recognized. Try a shorter command near the microphone." });
    return send(res, 200, { transcript });
  } catch (error) {
    if (error?.name === "TimeoutError") return send(res, 504, { error: "Voice transcription timed out. Try again." });
    console.error("Voice transcription failed", error);
    return send(res, 502, { error: "Voice transcription is unavailable. Try again shortly." });
  }
}
