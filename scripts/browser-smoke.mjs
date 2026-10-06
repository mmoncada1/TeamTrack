// Real Chromium checks without adding a browser automation dependency.
// Requires Node 22+ and Chrome/Edge, or CHROME_PATH pointing to Chromium.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const browserPath =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);
assert(browserPath, 'Install Chrome/Edge or set CHROME_PATH.');
const profile = mkdtempSync(join(tmpdir(), 'teamtrack-browser-'));
const artifacts = mkdtempSync(join(tmpdir(), 'teamtrack-artifacts-'));
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'],
  { windowsHide: true, stdio: 'ignore' },
);
const browser = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let socket;
let diagnose;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {
      /* Startup and navigation can briefly interrupt evaluation. */
    }
    await sleep(100);
  }
  throw new Error(`Timed out: ${label}`);
}
try {
  await until(() => existsSync(join(profile, 'DevToolsActivePort')), 'browser startup');
  await until(async () => (await fetch('http://127.0.0.1:5179')).ok, 'Vite startup');
  const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    socket.onopen = res;
    socket.onerror = rej;
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        rej(new Error(`Timed out browser command: ${method}`));
      }, 30000);
      pending.set(id, { res, rej, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.rej(new Error(message.error.message));
      else request.res(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Page.javascriptDialogOpening')
      send('Page.handleJavaScriptDialog', { accept: true });
  };
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
      );
    return result.result.value;
  };
  diagnose = async () => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(artifacts, 'failure.png'), Buffer.from(shot.data, 'base64'));
    return { artifacts, text: await evaluate('document.body.innerText'), errors };
  };
  const waitText = (text) =>
    until(() => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), text);
  const click = (text) =>
    evaluate(
      `(() => { const el = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!el) throw new Error('Missing control: ' + ${JSON.stringify(text)}); el.click(); })()`,
    );
  const setValue = (selector, value) =>
    evaluate(
      `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw new Error('Missing input'); const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`,
    );
  const inputByLabel = async (label, value) => {
    const selector = await evaluate(
      `(() => { const label = [...document.querySelectorAll('label')].find(e => e.firstChild?.textContent.trim() === ${JSON.stringify(label)}); const input = label?.control ?? label?.querySelector('input,select,textarea'); if (!input) throw new Error('Missing label: ' + ${JSON.stringify(label)}); input.dataset.smoke = 'input'; return '[data-smoke="input"]'; })()`,
    );
    await setValue(selector, value);
    await evaluate(`delete document.querySelector('[data-smoke="input"]').dataset.smoke`);
  };
  const dbRecord = async (table, key) =>
    evaluate(
      `new Promise((resolve, reject) => { const request = indexedDB.open('teamtrack'); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result; const r = db.transaction(${JSON.stringify(table)}).objectStore(${JSON.stringify(table)}).${key ? `get(${JSON.stringify(key)})` : 'getAll()'}; r.onsuccess = () => { resolve(r.result); db.close(); }; r.onerror = () => reject(r.error); }; })`,
    );
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: 'http://127.0.0.1:5179' });
  await waitText('New team');
  console.log('Checking football team creation…');
  await waitText('My Team');
  await click('New team');
  await setValue('#new-team-name', 'Browser Flag');
  await setValue('#new-team-sport', 'football');
  await click('Create team');
  await waitText('Browser Flag · 7v7 flag football');
  console.log('Checking formations, route dragging, ball actions, and drawings…');
  assert.equal(
    await evaluate(
      `!![...document.querySelectorAll('nav a')].find(e => e.textContent === 'Matches')`,
    ),
    false,
  );
  await evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open('teamtrack'); request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction(['teams', 'players', 'photos'], 'readwrite');
      const teams = tx.objectStore('teams').getAll(); teams.onsuccess = () => {
        const team = teams.result.find(t => t.name === 'Browser Flag');
        tx.objectStore('players').put({ id: 'browser-flag-player', teamId: team.id, name: 'Browser Flag Player', jerseyNumber: 7, preferredGroup: 'MID', availability: 'active', photoId: 'browser-flag-photo', createdAt: Date.now(), updatedAt: Date.now() });
        tx.objectStore('photos').put({ id: 'browser-flag-photo', playerId: 'browser-flag-player', mimeType: 'image/svg+xml', width: 48, height: 48, createdAt: Date.now(), blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#3879ac"/><circle cx="24" cy="16" r="9" fill="#ffd6a5"/><path d="M6 48 Q6 29 24 29 Q42 29 42 48" fill="#ffffff"/></svg>'], { type: 'image/svg+xml' }) });
      };
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    };
  })`);
  // Native IndexedDB writes do not notify Dexie's live queries; reload the seeded roster.
  await send('Page.reload');
  await waitText('Browser Flag · 7v7 flag football');
  await click('Formations');
  await waitText('New formation');
  await click('New formation');
  await waitText('Formation editor');
  await inputByLabel('Formation name', 'Browser Spread');
  await click('Autofill from roster');
  await until(
    () => evaluate(`!!document.querySelector('image[aria-label="Photo of Browser Flag Player"]')`),
    'formation portrait',
  );
  await click('Save formation');
  await waitText('Saved on this device.');
  await click('Back');
  await click('Playbook');
  await waitText('Use Mesh');
  await click('New play');
  await waitText('Starting formation');
  await inputByLabel('Play name', 'Browser Formation Play');
  await click('Create play');
  await waitText('Play editor');
  const [formationPlay] = await dbRecord('footballPlays');
  assert.equal(formationPlay.formationId, (await dbRecord('footballFormations'))[0].id);
  assert.equal(formationPlay.players[0].rosterPlayerId, 'browser-flag-player');
  await until(
    () => evaluate(`!!document.querySelector('image[aria-label="Photo of Browser Flag Player"]')`),
    'play portrait',
  );
  await click('Back');
  await waitText('Delete');
  await click('Delete');
  await click('Delete play');
  await until(
    async () => (await dbRecord('footballPlays')).length === 0,
    'remove formation test play',
  );
  await click('Use Mesh');
  await waitText('Play editor');
  await click('Autofill from roster');
  await inputByLabel('Play name', 'Browser Mesh');
  await inputByLabel('Route / assignment', 'post');
  await click('Flip left/right');
  const fieldBox = await evaluate(
    `(() => { const svg = document.querySelector('svg[aria-label="7v7 football field and play art"]'); svg.scrollIntoView({ block: 'center' }); const r = svg.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`,
  );
  const mouse = (type, x, y, button = 'left', buttons = 1) =>
    send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button,
      buttons,
      clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0,
    });
  const at = (x, y) => ({
    x: fieldBox.x + (fieldBox.width * x) / 100,
    y: fieldBox.y + (fieldBox.height * y) / 100,
  });
  const start = at(12, 70);
  const end = at(20, 67);
  await mouse('mousePressed', start.x, start.y);
  await mouse('mouseMoved', end.x, end.y);
  await mouse('mouseReleased', end.x, end.y, 'left', 0);
  // Route handles also drag in a real browser, not just through form controls.
  const handle = await evaluate(
    `(() => { const r = document.querySelector('svg circle[style*="move"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );
  const moved = { x: handle.x + fieldBox.width * 0.03, y: handle.y - fieldBox.height * 0.035 };
  await mouse('mousePressed', handle.x, handle.y);
  await mouse('mouseMoved', moved.x, moved.y);
  await mouse('mouseReleased', moved.x, moved.y, 'left', 0);
  await click('Add / edit motion');
  const motion = at(35, 82);
  await mouse('mousePressed', motion.x, motion.y);
  await mouse('mouseReleased', motion.x, motion.y, 'left', 0);
  await click('Add handoff');
  await click('Place target');
  const exchange = at(45, 86);
  await mouse('mousePressed', exchange.x, exchange.y);
  await mouse('mouseReleased', exchange.x, exchange.y, 'left', 0);
  await click('Arrow');
  const inkStart = at(10, 30);
  const inkEnd = at(30, 20);
  await mouse('mousePressed', inkStart.x, inkStart.y);
  await mouse('mouseMoved', inkEnd.x, inkEnd.y);
  await mouse('mouseReleased', inkEnd.x, inkEnd.y, 'left', 0);
  await click('Save play');
  await waitText('Saved on this device.');
  const play = (await dbRecord('footballPlays'))[0];
  assert.equal(play.name, 'Browser Mesh');
  assert.equal(play.players[2].route.type, 'post');
  assert(Math.abs(play.players[2].position.x - 20) < 0.2);
  assert.equal(play.players[2].motion.length, 1);
  assert(
    Math.abs(play.players[2].route.points[0].x - 3) < 0.2,
    'Route control point drag must persist',
  );
  assert.equal(play.ballActions[1].type, 'handoff');
  assert(Math.abs(play.ballActions[1].target.x - 45) < 0.2);
  assert.equal(play.drawings.length, 1);
  const image = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  writeFileSync(join(artifacts, 'football-editor.png'), Buffer.from(image.data, 'base64'));
  await send('Page.reload');
  await waitText('Play editor');
  assert.equal(await evaluate(`document.querySelector('label input').value`), 'Browser Mesh');
  await click('Back');
  await waitText('Duplicate');
  await click('Duplicate');
  await waitText('Play editor');
  assert.equal((await dbRecord('footballPlays')).length, 2);
  console.log('Checking drive plans and whiteboard persistence…');
  await click('Back');
  await click('Drive plans');
  await waitText('New drive plan');
  await click('New drive plan');
  await waitText('Drive planner');
  await setValue('select[aria-label="Play to add"]', play.id);
  await click('Add play');
  await click('Repeat');
  await click('Next');
  await click('Save drive');
  await waitText('Drive saved.');
  const [drive] = await dbRecord('drivePlans');
  assert.equal(drive.entries.length, 2);
  assert.notEqual(drive.entries[0].id, drive.entries[1].id);
  await click('Back');
  await click('Whiteboard');
  await waitText('Football whiteboard');
  await click('Line');
  const boardBox = await evaluate(
    `(() => { const svg = document.querySelector('svg[aria-label="7v7 football field and play art"]'); svg.scrollIntoView({ block: 'center' }); const r = svg.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; })()`,
  );
  await mouse('mousePressed', boardBox.x + 60, boardBox.y + 60);
  await mouse('mouseMoved', boardBox.x + 140, boardBox.y + 90);
  await mouse('mouseReleased', boardBox.x + 140, boardBox.y + 90, 'left', 0);
  await until(
    async () => (await dbRecord('footballWhiteboards'))[0]?.drawings.length === 1,
    'whiteboard persistence',
  );
  await click('Undo');
  await until(
    async () => (await dbRecord('footballWhiteboards'))[0]?.drawings.length === 0,
    'whiteboard undo',
  );
  await click('Redo');
  await until(
    async () => (await dbRecord('footballWhiteboards'))[0]?.drawings.length === 1,
    'whiteboard redo',
  );
  // Small-screen editor keeps its controls and field available without horizontal overflow.
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  console.log('Checking small screens and soccer workflows…');
  await send('Page.navigate', { url: `http://127.0.0.1:5179/football/plays/${play.id}` });
  await waitText('Play editor');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  const mobile = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(artifacts, 'football-mobile.png'), Buffer.from(mobile.data, 'base64'));
  // Soccer still supports roster creation, saved lineups, match setup, and its pitch.
  await click('New team');
  await setValue('#new-team-name', 'Browser Soccer');
  await setValue('#new-team-sport', 'soccer');
  await click('Create team');
  await waitText('Lineups');
  await click('Roster');
  await waitText('+ Add player');
  await click('+ Add player');
  await waitText('Display name');
  await inputByLabel('Display name', 'Soccer Player');
  await click('Add player');
  await waitText('Soccer Player');
  await click('Lineups');
  await waitText('+ New lineup');
  await click('+ New lineup');
  await waitText('Lineup name');
  assert.equal(await evaluate(`document.body.innerText.includes('Formation')`), true);
  await send('Page.navigate', { url: 'http://127.0.0.1:5179/match/new' });
  await waitText('Opponent');
  await click('Whiteboard');
  await waitText('Draw on the pitch');
  assert.deepEqual(errors, [], `Unexpected browser exceptions: ${errors.join(', ')}`);
  console.log(`Browser smoke checks passed. Screenshots: ${artifacts}`);
} catch (error) {
  if (diagnose) {
    try {
      console.error(await diagnose());
    } catch (diagnosticError) {
      console.error('Browser diagnostics unavailable:', diagnosticError.message);
    }
  }
  throw error;
} finally {
  socket?.close();
  browser.kill();
  server.kill();
  await sleep(500);
  // Only remove this script's freshly allocated profile, within the resolved temp root.
  const target = resolve(profile);
  const root = resolve(tmpdir());
  assert(
    target.startsWith(root + sep) && target.split(sep).at(-1).startsWith('teamtrack-browser-'),
  );
  try {
    rmSync(target, { recursive: true, force: true });
  } catch {
    /* Chromium may briefly retain profile locks. */
  }
}
