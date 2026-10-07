import test from "node:test";
import assert from "node:assert/strict";
import { convertTypescriptBackup } from "./legacy-backup.mjs";

const teamId = "11111111-1111-1111-1111-111111111111";
const playerId = "22222222-2222-2222-2222-222222222222";
const image = "data:image/png;base64,aGVsbG8=";

test("version 5 backup retains photos, lineups, match settings, events, and alerts", () => {
  const backup = convertTypescriptBackup({
    version: 5,
    teams: [{ id: teamId, name: "A", sport: "soccer", photoId: "team-photo" }],
    players: [{ id: playerId, teamId, name: "B", preferredGroup: "GK", photoId: "player-photo" }],
    teamPhotos: [{ id: "team-photo", teamId, dataUrl: image }],
    photos: [{ id: "player-photo", playerId, dataUrl: image }],
    lineups: [{ id: "lineup", teamId, name: "First", formationId: "7v7-2-3-1", assignments: { gk: playerId } }],
    matches: [{
      id: "match", teamId, settings: { format: "7v7", formationId: "7v7-2-3-1", halfLengthMinutes: 25,
        numberOfHalves: 2, thresholds: { GK: { enabled: false, minutes: 10 } } },
      rosterPlayerIds: [playerId], events: [
        { id: "start", type: "MATCH_STARTED", matchClockMs: 0, timestamp: 100, playerIds: [playerId],
          formationId: "7v7-2-3-1", assignments: { gk: playerId } },
        { id: "goal", type: "GOAL", matchClockMs: 100, timestamp: 200, playerIds: [playerId],
          team: "us", scorerId: playerId, isOwnGoal: false },
      ],
      activeAlerts: [{ id: "alert", playerId, positionGroup: "GK", thresholdMinutes: 10,
        stintStartMs: 0, createdAtClockMs: 100, recommendation: { inPlayerId: playerId } }],
    }],
    settings: { theme: "dark" },
  });
  const { teams, players, lineups, matches } = backup.data;
  assert.equal(teams[0].photo_id, image);
  assert.equal(players[0].photo_id, image);
  assert.equal(lineups[0].formation_id, "7v7-2-3-1");
  assert.equal(matches[0].settings.thresholds.GK.minutes, 10);
  assert.equal(matches[0].events[0].data.assignments.gk, playerId);
  assert.equal(matches[0].events[1].data.scorer_id, playerId);
  assert.equal(matches[0].active_alerts[0].recommendation.in_player_id, playerId);
});

test("missing referenced photo fails instead of dropping the image", () => {
  assert.throws(() => convertTypescriptBackup({
    version: 5, teams: [{ id: teamId, name: "A", photoId: "missing" }],
    players: [], matches: [], lineups: [], teamPhotos: [], photos: [],
  }), /Photo missing/);
});
