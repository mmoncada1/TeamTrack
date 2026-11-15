function normalize(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueScorer(prefix, players) {
  const spoken = normalize(prefix);
  const matches = players.filter((player) => {
    const full = normalize(player.name || "");
    return full && (spoken === full || spoken === full.split(" ")[0]);
  });
  return matches.length === 1 ? matches[0] : null;
}

// Browser recognition can turn the soccer verb into a familiar surname.
// Only repair this phrase when the preceding name identifies one roster player.
export function chooseVoiceTranscript(alternatives, players = []) {
  const transcripts = alternatives.map((item) => typeof item === "string" ? item : item?.transcript)
    .filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  if (!transcripts.length) return "";
  const recognizedGoal = transcripts.find((item) => {
    const match = /^(.+?)\s+scored?\b/i.exec(item);
    return match && uniqueScorer(match[1], players);
  });
  if (recognizedGoal) return recognizedGoal;
  const top = transcripts[0];
  const mistakenGoal = /^(.+?)\s+ford([.!?]?)$/i.exec(top);
  if (mistakenGoal && uniqueScorer(mistakenGoal[1], players) &&
      !players.some((player) => normalize(player.name || "") === normalize(top))) {
    return `${mistakenGoal[1]} scored${mistakenGoal[2]}`;
  }
  return top;
}
