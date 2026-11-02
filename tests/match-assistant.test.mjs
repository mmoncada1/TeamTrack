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

test("loads the function and answers an unsupported method with JSON", async () => {
  const res = {
    status(code) { this.statusCode = code; return this; },
    setHeader() { return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: "GET" }, res);
  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.body, { error: "Method not allowed." });
});

async function ask(modelAnswer, question = "Who should I sub in?", matchContext = context) {
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
    await handler({ method: "POST", headers: { authorization: "Bearer test-token" }, body: { question, context: matchContext } }, res);
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
  assert.deepEqual(res.body.substitutions, [{ incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid" }]);
  assert.equal(request.response_format.mime_type, "application/json");
});

test("respects a spoken substitution with named incoming and outgoing players", async () => {
  const { res } = await ask({ answer: "Review the substitution." }, "Sam in for Alex");
  assert.deepEqual(res.body.substitutions, [{ incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid" }]);
});

test("respects a spoken sub-out command", async () => {
  const { res } = await ask({ answer: "Review the substitution." }, "Sub out Alex");
  assert.deepEqual(res.body.substitutions, [{ incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid" }]);
});

test("tolerates a small speech recognition error in a player name", async () => {
  const { res } = await ask({ answer: "Review the substitution." }, "Samm in for Alex");
  assert.deepEqual(res.body.substitutions, [{ incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid" }]);
});

test("does not offer an invalid model suggestion", async () => {
  const { res } = await ask({ answer: "Consider a substitution.", substitution: {
    incoming_player_id: "out", outgoing_player_id: "in", position_id: "mid",
  } }, "Summarize this match");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.substitutions, []);
});

test("turns an active alert into a popup proposal when Gemini only describes the swap", async () => {
  const withAlert = { ...context, alerts: [{ player_id: "out", recommendation: { in_player_id: "in" } }] };
  const { res } = await ask({
    answer: "Sam is on the bench and Alex is on the field. The app recommends Sam for Alex.",
    substitution: { incoming_player_id: "", outgoing_player_id: "", position_id: "" },
  }, "Who should I sub in?", withAlert);
  assert.deepEqual(res.body.substitutions, [{ incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid" }]);
  assert.match(res.body.answer, /Sam for Alex/);
});

test("chooses the longest waiting valid bench player even when an alert names another", async () => {
  const waiting = { ...context,
    players: [
      { id: "out", name: "Alex", preferred_groups: ["MID"] },
      { id: "short", name: "Sam", preferred_groups: ["MID"] },
      { id: "long", name: "Katie", preferred_groups: ["DEF"] },
    ],
    player_states: [
      { player_id: "out", status: "field", position_id: "mid", position_group: "MID", current_stint_ms: 660000 },
      { player_id: "short", status: "bench", current_stint_ms: 120000 },
      { player_id: "long", status: "bench", current_stint_ms: 900000 },
    ],
    alerts: [{ player_id: "out", recommendation: { in_player_id: "short" } }],
  };
  const { res } = await ask({ answer: "Sam for Alex." }, "Who should I sub in?", waiting);
  assert.equal(res.body.substitutions[0].incoming_player_id, "long");
});

test("selects a valid swap when no alert exists", async () => {
  const { res } = await ask({
    answer: "There is no alert yet.",
    substitution: { incoming_player_id: "", outgoing_player_id: "", position_id: "" },
  });
  assert.deepEqual(res.body.substitutions, [{ incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid" }]);
});

test("does not claim an actionable swap when nobody is available on the bench", async () => {
  const noBench = { ...context, player_states: context.player_states.map((state) =>
    state.player_id === "in" ? { ...state, status: "unavailable" } : state) };
  const { res } = await ask({ answer: "Sam for Alex.", substitution: {
    incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid",
  } }, "Who should I sub in?", noBench);
  assert.deepEqual(res.body.substitutions, []);
  assert.match(res.body.answer, /couldn't find a valid/);
});

test("rejects a suggested swap that breaks the coed minimum", async () => {
  const coed = {
    ...context,
    team: { coed: true, min_girls_on_field: 1 },
    players: [{ id: "out", name: "Alex", gender: "girl" }, { id: "in", name: "Sam", gender: "boy" }],
  };
  const { res } = await ask({ answer: "Sam for Alex.", substitution: {
    incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid",
  } }, "Who should I sub in?", coed);
  assert.deepEqual(res.body.substitutions, []);
});

test("rejects a swap after the outgoing player changes position", async () => {
  const moved = { ...context, player_states: context.player_states.map((state) =>
    state.player_id === "out" ? { ...state, position_id: "def" } : state) };
  const { res } = await ask({ answer: "Sam for Alex.", substitution: {
    incoming_player_id: "in", outgoing_player_id: "out", position_id: "mid",
  } }, "Summarize this match", moved);
  assert.deepEqual(res.body.substitutions, []);
});

test("plans three distinct substitutions for a three-subs request", async () => {
  const three = {
    ...context,
    players: [
      { id: "out1", name: "Alex", preferred_groups: ["MID"] },
      { id: "out2", name: "Jordan", preferred_groups: ["DEF"] },
      { id: "out3", name: "Casey", preferred_groups: ["FWD"] },
      { id: "in1", name: "Sam", preferred_groups: ["MID"] },
      { id: "in2", name: "Maya", preferred_groups: ["DEF"] },
      { id: "in3", name: "Taylor", preferred_groups: ["FWD"] },
    ],
    player_states: [
      { player_id: "out1", status: "field", position_id: "mid", position_group: "MID", current_stint_ms: 600000 },
      { player_id: "out2", status: "field", position_id: "def", position_group: "DEF", current_stint_ms: 500000 },
      { player_id: "out3", status: "field", position_id: "fwd", position_group: "FWD", current_stint_ms: 400000 },
      { player_id: "in1", status: "bench", current_stint_ms: 300000 },
      { player_id: "in2", status: "bench", current_stint_ms: 250000 },
      { player_id: "in3", status: "bench", current_stint_ms: 200000 },
    ],
  };
  const { res } = await ask({ answer: "Three swaps are available." }, "Make 3 best subs", three);
  assert.equal(res.body.substitutions.length, 3);
  assert.deepEqual(res.body.substitutions.map((item) => item.incoming_player_id), ["in1", "in2", "in3"]);
  assert.deepEqual(new Set(res.body.substitutions.flatMap((item) => [item.incoming_player_id, item.outgoing_player_id])).size, 6);
  assert.match(res.body.answer, /3 valid substitutions/);
  const words = await ask({ answer: "Three swaps are available." }, "Make three substitutions", three);
  assert.equal(words.res.body.substitutions.length, 3);
  const queued = await ask({ answer: "Three swaps are available." }, "Queue 3 subs", three);
  assert.equal(queued.res.body.substitutions.length, 3);
});

test("an open ended question proposes every player past the configured stint limit", async () => {
  const timed = {
    ...context,
    settings: { thresholds: { MID: { enabled: true, minutes: 10 }, DEF: { enabled: true, minutes: 12 } } },
    players: [
      { id: "out1", name: "Alex", preferred_groups: ["MID"] },
      { id: "out2", name: "Jordan", preferred_groups: ["DEF"] },
      { id: "out3", name: "Casey", preferred_groups: ["MID"] },
      { id: "in1", name: "Sam", preferred_groups: ["MID"] },
      { id: "in2", name: "Maya", preferred_groups: ["DEF"] },
      { id: "in3", name: "Taylor", preferred_groups: ["MID"] },
    ],
    player_states: [
      { player_id: "out1", status: "field", position_id: "mid1", position_group: "MID", current_stint_ms: 660000 },
      { player_id: "out2", status: "field", position_id: "def", position_group: "DEF", current_stint_ms: 780000 },
      { player_id: "out3", status: "field", position_id: "mid2", position_group: "MID", current_stint_ms: 540000 },
      { player_id: "in1", status: "bench", current_stint_ms: 600000 },
      { player_id: "in2", status: "bench", current_stint_ms: 600000 },
      { player_id: "in3", status: "bench", current_stint_ms: 600000 },
    ],
  };
  for (const question of ["How many subs should I make?", "What subs should I make?"]) {
    const { res } = await ask({ answer: "Consider rotating players." }, question, timed);
    assert.deepEqual(res.body.substitutions.map((item) => item.outgoing_player_id), ["out2", "out1"]);
  }
  const early = { ...timed, player_states: timed.player_states.map((state) =>
    state.status === "field" ? { ...state, current_stint_ms: 300000 } : state) };
  const { res } = await ask({ answer: "Consider rotating players." }, "How many subs should I make?", early);
  assert.deepEqual(res.body.substitutions, []);
  assert.match(res.body.answer, /No player has reached/);
});

test("stops a batch before a combined coed violation", async () => {
  const coed = {
    ...context,
    team: { coed: true, min_girls_on_field: 1 },
    players: [
      { id: "girl1", name: "A", gender: "girl", preferred_groups: ["MID"] },
      { id: "girl2", name: "B", gender: "girl", preferred_groups: ["MID"] },
      { id: "boy1", name: "C", gender: "boy", preferred_groups: ["MID"] },
      { id: "boy2", name: "D", gender: "boy", preferred_groups: ["MID"] },
    ],
    player_states: [
      { player_id: "girl1", status: "field", position_id: "mid1", position_group: "MID", current_stint_ms: 600000 },
      { player_id: "girl2", status: "field", position_id: "mid2", position_group: "MID", current_stint_ms: 500000 },
      { player_id: "boy1", status: "bench", current_stint_ms: 400000 },
      { player_id: "boy2", status: "bench", current_stint_ms: 300000 },
    ],
  };
  const { res } = await ask({ answer: "Two swaps are available." }, "Make two subs", coed);
  assert.equal(res.body.substitutions.length, 1);
  assert.match(res.body.answer, /1 of 2 requested/);
});

test("proposes scorer and optional assist from common goal wording", async () => {
  const goalContext = { ...context, players: [
    { id: "katie", name: "Katie Smith" }, { id: "matteo", name: "Matteo Rossi" },
  ] };
  for (const question of ["Katie scored assisted by Matteo", "Katie scored passed by Matteo", "Katie scored by Matteo", "Goal by Katie assisted by Matteo"]) {
    const { res } = await ask({ answer: "Goal." }, question, goalContext);
    assert.deepEqual(res.body.goal, { team: "us", scorer_id: "katie", assister_id: "matteo" }, question);
  }
  const { res } = await ask({ answer: "Goal." }, "Katie scored", goalContext);
  assert.deepEqual(res.body.goal, { team: "us", scorer_id: "katie", assister_id: null });
  const opponent = await ask({ answer: "Goal." }, "Opponent scored", goalContext);
  assert.deepEqual(opponent.res.body.goal, { team: "opponent", scorer_id: null, assister_id: null });
  const question = await ask({ answer: "No." }, "Did Katie score?", goalContext);
  assert.equal(question.res.body.goal, null);
});

test("proposes cards and injuries without recording them", async () => {
  const actions = { ...context, players: [{ id: "out", name: "Katie Smith" }],
    player_states: [{ player_id: "out", status: "field", position_id: "mid" }] };
  for (const [question, expected] of [
    ["Katie got a yellow card", { type: "card", player_id: "out", color: "yellow" }],
    ["Red card for Katie", { type: "card", player_id: "out", color: "red" }],
    ["Katie is injured", { type: "injury", player_id: "out" }],
  ]) {
    const { res } = await ask({ answer: "Done." }, question, actions);
    assert.deepEqual(res.body.matchAction, expected);
    assert.match(res.body.answer, /Review/);
  }
  const question = await ask({ answer: "No." }, "Did Katie get a yellow card?", actions);
  assert.equal(question.res.body.matchAction, null);
});
