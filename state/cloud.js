import React, { useContext, useEffect, useState } from "react";

const SignOutContext = React.createContext(null);

export function SignOutButton() {
  const signOut = useContext(SignOutContext);
  return React.createElement("button", { type: "button", className: "button ghost small", onClick: signOut }, "Sign out");
}

// The publishable key is designed for browser use. Database access is limited
// by the signed-in user's JWT and the RLS policies in the migrations.
const URL = "https://agtdyrerqbuwfwimbttj.supabase.co";
const KEY = "sb_publishable_7Hc6x5-_JGvimNXl2iMcig_shCj4LMq";
const SESSION_KEY = "teamtrack:supabase-session";
const DATA_PREFIXES = ["teamtrack:jac:", "teamtrack:whiteboard:"];
const isDataKey = (key) => DATA_PREFIXES.some((prefix) => key.startsWith(prefix));
let session = null;
let syncTimer = null;
let syncEnabled = false;
let syncing = Promise.resolve();
const photoPaths = new Map();

const dispatchStatus = (status) => window.dispatchEvent(new CustomEvent("teamtrack:sync", { detail: status }));

async function request(path, options = {}, token = null) {
  const response = await fetch(URL + path, {
    ...options,
    headers: {
      apikey: KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.msg || body?.error_description || body?.error || `Supabase returned ${response.status}`);
  return body;
}

function keepSession(next) {
  session = next;
  if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else localStorage.removeItem(SESSION_KEY);
}

async function refreshSession() {
  if (!session?.refresh_token) throw new Error("Please sign in again.");
  const next = await request("/auth/v1/token?grant_type=refresh_token", {
    method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  keepSession(next);
  return next;
}

async function validSession() {
  if (!session) throw new Error("Please sign in.");
  if (session.expires_at * 1000 < Date.now() + 60000) await refreshSession();
  return session;
}

async function authorizedRequest(path, options = {}) {
  await validSession();
  try { return await request(path, options, session.access_token); }
  catch (error) {
    if (!String(error.message).includes("401")) throw error;
    await refreshSession();
    return request(path, options, session.access_token);
  }
}

function currentData() {
  const payload = {};
  for (const key of Object.keys(localStorage)) if (isDataKey(key)) payload[key] = localStorage.getItem(key);
  return payload;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const photoCollections = ["teamtrack:jac:teams", "teamtrack:jac:players"];

async function uploadPhoto(dataUrl, teamId, kind, id) {
  if (!uuidPattern.test(teamId) || !uuidPattern.test(id)) throw new Error("Photo owner needs a UUID.");
  const blob = await fetch(dataUrl).then((response) => response.blob());
  const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  const extension = extensions[blob.type];
  if (!extension || blob.size > 2621440) throw new Error("Choose a JPEG, PNG, WebP, or GIF smaller than 2.5 MB.");
  const path = `${teamId}/${kind}/${id}-${crypto.randomUUID()}.${extension}`;
  const current = await validSession();
  const response = await fetch(`${URL}/storage/v1/object/profile-pictures/${path}`, {
    method: "POST", body: blob,
    headers: { apikey: KEY, Authorization: `Bearer ${current.access_token}`, "Content-Type": blob.type },
  });
  if (!response.ok) throw new Error(`Photo upload failed (${response.status}).`);
  return `storage://${path}`;
}

async function storedPayload() {
  const payload = currentData();
  for (const key of photoCollections) {
    if (!payload[key]) continue;
    const records = JSON.parse(payload[key]);
    for (const record of records) {
      if (!record.photo_id) continue;
      if (photoPaths.has(record.photo_id)) {
        record.photo_id = `storage://${photoPaths.get(record.photo_id)}`;
      } else if (record.photo_id.startsWith("data:image/")) {
        const teamId = key.endsWith(":teams") ? record.id : record.team_id;
        const original = record.photo_id;
        record.photo_id = await uploadPhoto(original, teamId, key.endsWith(":teams") ? "teams" : "players", record.id);
        photoPaths.set(original, record.photo_id.slice("storage://".length));
      }
    }
    payload[key] = JSON.stringify(records);
  }
  return payload;
}

async function hydratePhotos(payload) {
  const hydrated = { ...payload };
  photoPaths.clear();
  for (const key of photoCollections) {
    if (!hydrated[key]) continue;
    const records = JSON.parse(hydrated[key]);
    for (const record of records) {
      if (!record.photo_id?.startsWith("storage://")) continue;
      const path = record.photo_id.slice("storage://".length);
      const result = await authorizedRequest(`/storage/v1/object/sign/profile-pictures/${path}`, {
        method: "POST", body: JSON.stringify({ expiresIn: 604800 }),
      });
      const signedPath = result.signedURL || result.signedUrl;
      const signedUrl = signedPath.startsWith("http") ? signedPath : signedPath.startsWith("/storage/v1/") ? URL + signedPath : URL + "/storage/v1" + signedPath;
      photoPaths.set(signedUrl, path);
      record.photo_id = signedUrl;
    }
    hydrated[key] = JSON.stringify(records);
  }
  return hydrated;
}

async function syncTeamsAndPlayers(payload, userId, includePhotos) {
  const teams = JSON.parse(payload["teamtrack:jac:teams"] || "[]");
  const players = JSON.parse(payload["teamtrack:jac:players"] || "[]");
  const picture = (value) => value?.startsWith("storage://") ? value.slice("storage://".length) : null;
  if (teams.length) {
    await authorizedRequest("/rest/v1/teams?on_conflict=id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(teams.map((team) => ({
        id: team.id, owner_user_id: userId, name: team.name,
        sport: team.sport || "soccer", coed: Boolean(team.coed),
        min_girls_on_field: team.sport === "football" ? null : team.min_girls_on_field,
        profile_picture: includePhotos ? picture(team.photo_id) : null,
      }))),
    });
  }
  if (!includePhotos) return;
  if (players.length) {
    await authorizedRequest("/rest/v1/roster_players?on_conflict=id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(players.map((player) => ({
        id: player.id, team_id: player.team_id, name: player.name,
        jersey_number: player.jersey_number, gender: player.gender,
        position: player.preferred_group || "MID", availability: player.availability || "active",
        profile_picture: picture(player.photo_id),
      }))),
    });
  }
  const existingPlayers = await authorizedRequest("/rest/v1/roster_players?select=id");
  const playerIds = new Set(players.map((player) => player.id));
  for (const player of existingPlayers) if (!playerIds.has(player.id)) {
    await authorizedRequest(`/rest/v1/roster_players?id=eq.${player.id}`, { method: "DELETE" });
  }
  const existingTeams = await authorizedRequest("/rest/v1/teams?select=id");
  const teamIds = new Set(teams.map((team) => team.id));
  for (const team of existingTeams) if (!teamIds.has(team.id)) {
    await authorizedRequest(`/rest/v1/teams?id=eq.${team.id}`, { method: "DELETE" });
  }
}

function replaceData(payload) {
  syncEnabled = false;
  for (const key of Object.keys(localStorage)) if (isDataKey(key)) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(payload)) {
    if (isDataKey(key) && typeof value === "string") localStorage.setItem(key, value);
  }
}

async function saveSnapshot() {
  const current = await validSession();
  dispatchStatus("Saving…");
  await syncTeamsAndPlayers(currentData(), current.user.id, false);
  const payload = await storedPayload();
  await syncTeamsAndPlayers(payload, current.user.id, true);
  await authorizedRequest("/rest/v1/app_snapshots?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: current.user.id, payload, updated_at: new Date().toISOString() }),
  });
  dispatchStatus("Saved");
}

function queueSave() {
  if (!syncEnabled) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncing = syncing.then(saveSnapshot).catch((error) => dispatchStatus(`Sync error: ${error.message}`));
  }, 700);
}

// Jac's storage functions all use localStorage. Observe those writes without
// changing every state mutation; only signed-in state is sent to Supabase.
if (typeof window !== "undefined") {
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && isDataKey(String(key))) queueSave();
  };
  Storage.prototype.removeItem = function (key) {
    originalRemoveItem.call(this, key);
    if (this === localStorage && isDataKey(String(key))) queueSave();
  };
}

async function loadSnapshot() {
  const current = await validSession();
  const rows = await authorizedRequest(`/rest/v1/app_snapshots?select=payload&user_id=eq.${current.user.id}`);
  return rows[0]?.payload || null;
}

function fromConfirmationLink() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (!hash.get("access_token") || !hash.get("refresh_token")) return null;
  const next = {
    access_token: hash.get("access_token"), refresh_token: hash.get("refresh_token"),
    expires_at: Math.floor(Date.now() / 1000) + Number(hash.get("expires_in") || 3600),
    user: { id: hash.get("user_id") },
  };
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return next;
}

export function AuthGate({ children }) {
  const [phase, setPhase] = useState("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function finishSignIn(next) {
    keepSession(next);
    const remote = await loadSnapshot();
    if (remote) {
      replaceData(await hydratePhotos(remote));
      syncEnabled = true;
      setPhase("ready");
    } else {
      setPhase("choose-data");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const confirmed = fromConfirmationLink();
        if (confirmed) {
          // Fetch the user rather than trusting a user ID in the URL fragment.
          const user = await request("/auth/v1/user", {}, confirmed.access_token);
          confirmed.user = user;
          await finishSignIn(confirmed);
          return;
        }
        const saved = localStorage.getItem(SESSION_KEY);
        if (!saved) { setPhase("login"); return; }
        keepSession(JSON.parse(saved));
        await validSession();
        await finishSignIn(session);
      } catch (problem) {
        keepSession(null);
        setError(problem.message);
        setPhase("login");
      }
    })();
  }, []);

  async function signIn(event, createAccount) {
    event.preventDefault(); setError(""); setMessage(""); setPhase("loading");
    try {
      const path = createAccount ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
      const response = await request(path, { method: "POST", body: JSON.stringify({ email, password }) });
      if (!response.access_token) {
        setMessage("Check your email to confirm your account, then return and sign in.");
        setPhase("login"); return;
      }
      await finishSignIn(response);
    } catch (problem) { setError(problem.message); setPhase("login"); }
  }

  async function chooseData(importBrowserData) {
    try {
      if (!importBrowserData) replaceData({});
      syncEnabled = true;
      await saveSnapshot();
      setPhase("ready");
    } catch (problem) { syncEnabled = false; setError(problem.message); }
  }

  async function signOut() {
    clearTimeout(syncTimer);
    try {
      await syncing;
      await saveSnapshot();
    } catch (problem) {
      window.alert(`Could not sign out because syncing failed: ${problem.message}`);
      return;
    }
    syncEnabled = false;
    try { await request("/auth/v1/logout", { method: "POST" }, session?.access_token); } catch {}
    keepSession(null);
    replaceData({});
    setPhase("login");
  }

  const h = React.createElement;
  if (phase === "ready") return h(SignOutContext.Provider, { value: signOut }, children);
  return h("main", { className: "auth-screen" },
    h("section", { className: "card form-stack" },
      h("h1", null, "TeamTrack"),
      phase === "loading" ? h("p", null, "Connecting to Supabase…") : null,
      phase === "choose-data" ? h(React.Fragment, null,
        h("p", null, "No cloud data exists for this account. Choose how to begin."),
        h("button", { className: "button primary", onClick: () => chooseData(true) }, "Import this browser's teams"),
        h("button", { className: "button secondary", onClick: () => chooseData(false) }, "Start with a new team")) : null,
      phase === "login" ? h("form", { className: "form-stack", onSubmit: (event) => signIn(event, false) },
        h("label", null, "Email", h("input", { className: "input", type: "email", required: true, value: email, onChange: (event) => setEmail(event.target.value) })),
        h("label", null, "Password", h("input", { className: "input", type: "password", required: true, minLength: 6, value: password, onChange: (event) => setPassword(event.target.value) })),
        h("button", { className: "button primary", type: "submit" }, "Sign in"),
        h("button", { className: "button secondary", type: "button", onClick: (event) => signIn(event, true) }, "Create account")) : null,
      error ? h("p", { className: "error", role: "alert" }, error) : null,
      message ? h("p", { role: "status" }, message) : null));
}
