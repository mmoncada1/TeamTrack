import assert from "node:assert/strict";
import test from "node:test";
import { chooseVoiceTranscript } from "../components/voice-transcript.js";

const players = [{ name: "Henry Lee" }, { name: "Katie Kim" }];

test("prefers a roster-aware goal over the browser's first alternative", () => {
  assert.equal(chooseVoiceTranscript(["Henry Ford", "Henry scored"], players), "Henry scored");
});

test("repairs the known scored/Ford error only for a unique player", () => {
  assert.equal(chooseVoiceTranscript(["Henry Ford"], players), "Henry scored");
  assert.equal(chooseVoiceTranscript(["Henry Ford"], [...players, { name: "Henry Smith" }]), "Henry Ford");
  assert.equal(chooseVoiceTranscript(["Henry Ford"], [...players, { name: "Henry Ford" }]), "Henry Ford");
  assert.equal(chooseVoiceTranscript(["Car Ford"], players), "Car Ford");
});
