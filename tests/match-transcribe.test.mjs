import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/match-transcribe.js";

const teamId = "11111111-1111-4111-8111-111111111111";
const payload = { teamId, audio: Buffer.from("audio sample").toString("base64"),
  mimeType: "audio/webm;codecs=opus", playerNames: ["Henry Lee", "Katie Kim"] };

function response() {
  return { status(code) { this.statusCode = code; return this; },
    setHeader() { return this; }, json(body) { this.body = body; return this; } };
}

test("transcribes a short clip with roster and soccer context", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.GEMINI_API_KEY;
  let geminiRequest;
  let geminiUrl;
  globalThis.fetch = async (url, options) => {
    if (url.includes("supabase.co")) return { ok: true, json: async () => [{ id: teamId }] };
    geminiUrl = url;
    geminiRequest = JSON.parse(options.body);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "Henry scored by Katie" }] } }] }) };
  };
  process.env.GEMINI_API_KEY = "test-key";
  try {
    const res = response();
    await handler({ method: "POST", headers: { authorization: "Bearer test-token" }, body: payload }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.transcript, "Henry scored by Katie");
    assert.match(geminiUrl, /gemini-3\.5-flash-lite:generateContent$/);
    assert.deepEqual(geminiRequest.contents[0].parts[1].inlineData,
      { mimeType: "audio/webm", data: payload.audio });
    assert.match(geminiRequest.contents[0].parts[0].text, /Henry Lee/);
    assert.match(geminiRequest.contents[0].parts[0].text, /scored/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});

test("distinguishes silence from an empty model response", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.GEMINI_API_KEY;
  const oldError = console.error;
  let geminiResult = { candidates: [{ content: { parts: [{ text: "NO_SPEECH" }] } }] };
  globalThis.fetch = async (url) => url.includes("supabase.co")
    ? { ok: true, json: async () => [{ id: teamId }] }
    : { ok: true, json: async () => geminiResult };
  process.env.GEMINI_API_KEY = "test-key";
  console.error = () => {};
  try {
    const silence = response();
    await handler({ method: "POST", headers: { authorization: "Bearer test-token" }, body: payload }, silence);
    assert.equal(silence.statusCode, 422);
    geminiResult = { candidates: [{ content: { parts: [{}] }, finishReason: "STOP" }] };
    const empty = response();
    await handler({ method: "POST", headers: { authorization: "Bearer test-token" }, body: payload }, empty);
    assert.equal(empty.statusCode, 502);
    assert.match(empty.body.error, /returned no text/);
  } finally {
    globalThis.fetch = oldFetch;
    console.error = oldError;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});

test("rejects invalid audio and inaccessible teams before transcription", async () => {
  const invalid = response();
  await handler({ method: "POST", headers: { authorization: "Bearer test-token" },
    body: { ...payload, mimeType: "text/plain" } }, invalid);
  assert.equal(invalid.statusCode, 400);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => [] });
  try {
    const unavailable = response();
    await handler({ method: "POST", headers: { authorization: "Bearer test-token" }, body: payload }, unavailable);
    assert.equal(unavailable.statusCode, 403);
  } finally { globalThis.fetch = oldFetch; }
});
