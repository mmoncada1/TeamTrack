import test from "node:test";
import assert from "node:assert/strict";
import { validSubstitution } from "../lib/substitution-validation.mjs";

const swap = { incoming_player_id: "bench", outgoing_player_id: "field", position_id: "mid" };
const context = {
  match: { status: "in_progress" },
  players: [{ id: "field", gender: "girl" }, { id: "bench", gender: "boy" }, { id: "other", gender: "girl" }],
  player_states: [
    { player_id: "field", status: "field", position_id: "mid" },
    { player_id: "bench", status: "bench", position_id: null },
    { player_id: "other", status: "field", position_id: "def" },
  ],
};

test("accepts a current field-to-bench swap", () => {
  assert.equal(validSubstitution(swap, context), true);
});

test("rejects stale, ineligible, and finished-match swaps", () => {
  assert.equal(validSubstitution({ ...swap, position_id: "def" }, context), false);
  assert.equal(validSubstitution({ ...swap, incoming_player_id: "other" }, context), false);
  assert.equal(validSubstitution(swap, { ...context, match: { status: "ended" } }), false);
});

test("rejects a swap that breaks the coed minimum", () => {
  const coed = { ...context, team: { coed: true, min_girls_on_field: 2 } };
  assert.equal(validSubstitution(swap, coed), false);
  assert.equal(validSubstitution({ ...swap, outgoing_player_id: "other", position_id: "def" }, coed), false);
  const girlBench = { ...coed, players: coed.players.map((player) => player.id === "bench" ? { ...player, gender: "girl" } : player) };
  assert.equal(validSubstitution(swap, girlBench), true);
});
