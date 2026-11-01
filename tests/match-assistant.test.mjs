import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/match-assistant.js";

const context = {
  match: { id: "match-1", team_id: "11111111-1111-4111-8111-111111111111", status: "in_progress" },
  players: [{ id: "out", name: "Alex" }, { id: "in", name: "Sam" }],
  player_states: [
    { player_id: "out", status: "field", position_id: "mid" },
    { player_id: "in", status: "bench", position_id: null },
  ],
};

function mockResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

async function ask(modelAnswer) {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.GEMINI_API_KEY;
  let request;
  globalThis.fetch = async (url, options) => {
    if (url.includes("supabase.co")) return mockResponse([{ id: context.match.team_id }]);
    request = JSON.parse(options.body);
    return mockResponse({ steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(modelAnswer) }] }] });
  };
  process.env.GEMINI_API_KEY = "test-key";
  const res = {
    statusCode: 0,
    status(code) { this.statusCode = code; return this; },
    setHeader() { return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    await handler({ method: "POST", headers: { authorization: "Bearer test-token" }, body: { question: "Who should I sub in?", context } }, res);
    return { res, request };
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
}

test("returns a validated suggestion for coach approval", async () => {
  const { res, request } = await ask({ answer: "Sam has spent more time on the bench.", substitution: {
    incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid",
  } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.substitution, { incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid" });
  assert.equal(request.response_format.mime_type, "application/json");
});

test("does not offer an invalid model suggestion", async () => {
  const { res } = await ask({ answer: "Consider a substitution.", substitution: {
    incoming_player_id: "out", outgoing_player_id: "in", position_id: "mid",
  } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.substitution, null);
});
