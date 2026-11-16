import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/roster-assistant.js";

const teamId = "11111111-1111-4111-8111-111111111111";
const roster = [{ id: "henry", name: "Henry Lee" }];

async function ask(question, options = {}) {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.GEMINI_API_KEY;
  const requests = [];
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    if (url.includes("supabase.co")) return { ok: true, status: 200, json: async () => [{ id: teamId }] };
    requests.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ steps: [{ type: "model_output", content: [
      { type: "text", text: JSON.stringify(options.generated || { players: [] }) },
    ] }] }) };
  };
  const res = {
    status(code) { this.statusCode = code; return this; },
    setHeader() { return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    await handler({ method: "POST", headers: { authorization: "Bearer test-token" },
      body: { question, teamId, coed: options.coed || false, roster: options.roster || roster,
        matches: options.matches || [] } }, res);
    return { res, requests };
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
}

test("generates a reviewable sample roster without reusing current players", async () => {
  const players = [
    { name: "Maya Ortiz", preferred_groups: ["GK"], gender: "girl" },
    { name: "Jude Park", preferred_groups: ["DEF"], gender: "girl" },
  ];
  const { res, requests } = await ask("Generate 2 players for a roster", { coed: true, generated: { players } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mode, "generate");
  assert.deepEqual(res.body.players, players);
  assert.equal(requests.length, 1);
  assert.match(requests[0].input, /Existing names.*Henry Lee/);
  const duplicate = await ask("Generate 2 players for a roster", { generated: { players: [
    { name: "Henry Lee", preferred_groups: ["GK"], gender: "none" },
    { name: "Jude Park", preferred_groups: ["DEF"], gender: "none" },
  ] } });
  assert.equal(duplicate.res.statusCode, 502);
});

test("add names returns only the named players and never calls the model", async () => {
  const { res, requests } = await ask("Add Audrey, Alex, and Matteo");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mode, "add");
  assert.deepEqual(res.body.players.map((player) => player.name), ["Audrey", "Alex", "Matteo"]);
  assert.deepEqual(res.body.players.map((player) => player.preferred_groups), [["MID"], ["MID"], ["MID"]]);
  assert.equal(requests.length, 0);
});

test("answers goals, assists, and minutes from supplied match summaries", async () => {
  const matches = [
    { date: "2026-11-01", opponent: "Falcons", status: "ended", players: [
      { player_id: "henry", goals: 2, assists: 1, field_ms: 1800000 },
    ] },
    { date: "2026-11-08", opponent: "Wolves", status: "ended", players: [
      { player_id: "henry", goals: 1, assists: 0, field_ms: 1200000 },
    ] },
  ];
  const { res, requests } = await ask("How many goals has Henry scored?", { matches });
  assert.equal(res.statusCode, 200);
  assert.match(res.body.answer, /Henry Lee has scored 3 goals/);
  assert.match(res.body.answer, /vs Falcons: 2 goals/);
  assert.match(res.body.answer, /vs Wolves: 1 goal/);
  assert.doesNotMatch(res.body.answer, /assists|on field/);
  assert.equal(requests.length, 0);
  const possessive = await ask("show me Henry's stats", { matches });
  assert.equal(possessive.res.body.stats.name, "Henry Lee");
  assert.equal(possessive.res.body.stats.goals, 3);
  assert.equal(possessive.res.body.stats.assists, 1);
  assert.equal(possessive.res.body.stats.games.length, 2);
  assert.equal(possessive.requests.length, 0);
  const singleScoringGame = await ask("Henry goals?", { matches: [
    { date: "2026-11-01", opponent: "Falcons", players: [{ player_id: "henry", goals: 2 }] },
    { date: "2026-11-08", opponent: "Wolves", players: [{ player_id: "henry", goals: 0 }] },
  ] });
  assert.doesNotMatch(singleScoringGame.res.body.answer, /Wolves/);
});

test("answers natural leaderboard questions from roster match history", async () => {
  const players = [...roster, { id: "audrey", name: "Audrey Chen" }];
  const matches = [{ date: "2026-11-01", opponent: "Falcons", status: "ended", players: [
    { player_id: "henry", goals: 2, assists: 0, field_ms: 1800000 },
    { player_id: "audrey", goals: 1, assists: 2, field_ms: 2400000 },
  ] }];
  const goals = await ask("who's scored the most goals?", { roster: players, matches });
  assert.match(goals.res.body.answer, /Henry Lee has the most goals: 2/);
  assert.equal(goals.requests.length, 0);
  const assists = await ask("Which player has the most assists?", { roster: players, matches });
  assert.match(assists.res.body.answer, /Audrey Chen has the most assists: 2/);
  const minutes = await ask("who played the most minutes?", { roster: players, matches });
  assert.match(minutes.res.body.answer, /Audrey Chen has the most minutes: 40/);
});
