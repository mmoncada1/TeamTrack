import React, { useEffect, useRef, useState } from "react";

const DURATION = 9000;
const NAV = ["Dashboard", "Roster", "Lineups", "Matches", "Team"];

const cx = (...parts) => parts.filter(Boolean).join(" ");
const box = (left, top, width, height) => ({ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` });
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function Pitch({ area }) {
  return <div className="wt-pitch" style={box(area.l, area.t, area.w, area.h)}>
    <svg viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="rgb(255 255 255 / .8)" strokeWidth="0.8">
        <rect x="3" y="3" width="94" height="144" /><line x1="3" y1="75" x2="97" y2="75" /><circle cx="50" cy="75" r="10" />
        <rect x="28" y="125" width="44" height="22" /><rect x="28" y="3" width="44" height="22" />
      </g>
    </svg>
  </div>;
}

function Token({ x, y, label, name, group, time, due, children }) {
  return <div className={cx("wt-token", `wt-${group}`)} style={{ left: `${x}%`, top: `${y}%` }}>
    <span className="wt-token-avatar">{label}</span>
    {name && <span className="wt-token-name">{name}</span>}
    {time && <span className={cx("wt-token-time", due && "due")}>{time}</span>}
    {children}
  </div>;
}

const ROSTER = [["#1", "Alex Rivera", "Goalkeeper", "boy"], ["#2", "Jordan Lee", "Defender", "boy"], ["#5", "Maya Torres", "Midfielder", "girl"], ["#6", "Priya Shah", "Midfielder", "girl"], ["#10", "Diego Santos", "Defender", "boy"]];

function RosterScene({ t, pin }) {
  const typed = "Ella Martin".slice(0, Math.max(0, Math.floor((t - 600) / 90)));
  const added = t >= 2700;
  const rows = added ? [["#9", "Ella Martin", "Forward", "girl"], ...ROSTER] : ROSTER;
  return <div className="wt-scene">
    <div className="wt-panel wt-roster" style={box(4, 6, 58, 88)}>
      <div className="wt-panel-head">
        <div><strong>Riverside FC roster</strong><span className={cx("wt-pill", t >= 6200 && "on")}>Co-ed · min. 2 girls{pin(2)}</span></div>
        <span className={cx("wt-btn primary", t < 500 && "pressed")}>Add player{pin(0)}</span>
      </div>
      <ul>{rows.map(([number, name, position, gender], index) => {
        const out = name === "Jordan Lee" && t >= 4000;
        return <li key={name} className={cx("wt-row", (added || t > 150 * index) && "in", name === "Ella Martin" && t < 4300 && "fresh", out && "out")}>
          <span className="wt-avatar">{name[0]}</span>
          <span className="wt-row-main"><b>{number} {name}</b><small>{position}{t >= 6200 ? ` · ${gender === "girl" ? "Girl" : "Boy"}` : ""}</small></span>
          {name === "Jordan Lee" && <span className={cx("wt-badge", out && "on")}>Unavailable{pin(1)}</span>}
        </li>;
      })}</ul>
    </div>
    <div className={cx("wt-panel wt-modal", t < 2600 && "on")} style={box(66, 12, 30, 66)}>
      <strong>Add player</strong>
      <label>Display name<span className="wt-input">{typed}<i className="wt-caret" /></span></label>
      <label>Positions</label>
      <div className="wt-checks">{["GK", "DEF", "MID", "FWD"].map((group) => <span key={group} className={cx("wt-check", group === "FWD" && t >= 2000 && "on")}>{group}</span>)}</div>
      <span className={cx("wt-btn primary", t >= 2300 && t < 2600 && "pressed")}>Add player</span>
    </div>
  </div>;
}

const LINEUP_PITCH = { l: 44, t: 5, w: 36, h: 90 };
const SLOTS = { GK: [50, 88], LB: [25, 68], RB: [75, 68], LM: [18, 42], CM: [50, 46], RM: [82, 42], ST: [50, 17] };
const onPitch = ([x, y], area) => [area.l + area.w * x / 100, area.t + area.h * y / 100];
const LINEUP = [["AR", "Alex", "GK", "GK"], ["JL", "Jordan", "DEF", "LB"], ["DS", "Diego", "DEF", "RB"], ["MT", "Maya", "MID", "LM"], ["PS", "Priya", "MID", "CM"], ["GW", "Grace", "MID", "RM"], ["TB", "Theo", "FWD", "ST"], ["SO", "Sam", "DEF", null]];

function LineupScene({ t, pin }) {
  const placedAt = (index) => 1200 + index * 480;
  return <div className="wt-scene">
    <div className="wt-format" style={{ left: "4%", top: "6%" }}>
      {["7v7", "9v9", "11v11"].map((format) => <span key={format} className={cx("wt-chip", format === "7v7" && "on")}>{format}</span>)}
      <span className="wt-select">2-3-1</span>{pin(0)}
    </div>
    <div className="wt-bench" style={box(4, 18, 32, 76)}><small>Bench</small>{pin(1)}</div>
    <Pitch area={LINEUP_PITCH} />
    {LINEUP.map(([, , , slot], index) => {
      if (!slot) return null;
      const [x, y] = onPitch(SLOTS[slot], LINEUP_PITCH);
      return <span key={slot} className={cx("wt-slot", t >= placedAt(index) && "filled")} style={{ left: `${x}%`, top: `${y}%` }} />;
    })}
    {LINEUP.map(([initials, name, group, slot], index) => {
      const placed = slot && t >= placedAt(index);
      const [x, y] = placed ? onPitch(SLOTS[slot], LINEUP_PITCH) : [12 + (index % 2) * 14, 34 + Math.floor(index / 2) * 15];
      return <Token key={initials} x={x} y={y} label={initials} name={name} group={group} />;
    })}
    <span className={cx("wt-btn primary wt-save", t >= 5600 && t < 5900 && "pressed")} style={{ right: "4%", bottom: "6%" }}>Save lineup{pin(2)}</span>
    <span className={cx("wt-toast", t >= 6000 && "on")}>Lineup saved</span>
  </div>;
}

const LIVE_PITCH = { l: 4, t: 5, w: 34, h: 90 };
const LIVE_FIELD = [["AR", "GK", "GK"], ["MT", "MID", "LM"], ["PS", "MID", "CM"], ["GW", "MID", "RM"], ["TB", "FWD", "ST"], ["JL", "DEF", "RB"]];

function LiveScene({ t, pin }) {
  const seconds = 600 + t * 25 / 1000;
  const subbed = t >= 7000;
  const scored = t >= 3000;
  const [lbX, lbY] = onPitch(SLOTS.LB, LIVE_PITCH);
  return <div className="wt-scene">
    <Pitch area={LIVE_PITCH} />
    {LIVE_FIELD.map(([initials, group, slot]) => {
      const [x, y] = onPitch(SLOTS[slot], LIVE_PITCH);
      return <Token key={initials} x={x} y={y} label={initials} group={group} time={clock(seconds)} />;
    })}
    <Token x={subbed ? 47.5 : lbX} y={subbed ? 30 : lbY} label="DS" group="DEF" time={subbed ? "0:00" : clock(seconds)} due={!subbed && t >= 4500} />
    <Token x={subbed ? lbX : 47.5} y={subbed ? lbY : 30} label="SO" group="DEF" time={subbed ? clock((t - 7000) * 25 / 1000) : "0:00"} />
    <div className="wt-bench wt-live-bench" style={box(41, 5, 13, 90)}><small>Bench</small></div>

    <div className="wt-panel wt-scoreboard" style={box(57, 5, 39, 34)}>
      <div className="wt-clock">{clock(seconds)}<span className="wt-live"><i />Live · Half 1</span>{pin(0)}</div>
      <div className="wt-score">
        <span>Riverside<b key={scored ? "1" : "0"} className={scored ? "bump" : ""}>{scored ? 1 : 0}</b></span>
        <em>–</em>
        <span>Northside<b>0</b></span>
      </div>
      <span className={cx("wt-btn primary", t >= 2600 && t < 3000 && "pressed")}>Add goal{pin(1)}</span>
    </div>

    <div className={cx("wt-alert", t >= 4500 && !subbed && "on")} style={box(57, 42, 39, 23)}>
      <div className="wt-alert-head"><strong>Diego Santos (DEF)</strong><small>{clock(seconds)} on the field · due for a rest</small></div>
      <span className={cx("wt-btn primary", t >= 6600 && "pressed")}>Sub in Sam Okafor{pin(2)}</span>
    </div>

    <div className="wt-panel wt-events" style={box(57, 68, 39, 27)}>
      <strong>Events</strong>
      <ul>
        <li className={cx(scored && "on")}><time>12'</time>Goal · Maya Torres</li>
        <li className={cx(subbed && "on")}><time>13'</time>Sam Okafor on for Diego Santos</li>
      </ul>
    </div>
  </div>;
}

const MINUTES = [["Alex Rivera", 50], ["Maya Torres", 42], ["Priya Shah", 38], ["Diego Santos", 30], ["Sam Okafor", 25]];
const ANSWER = "Riverside won 2–1. Maya scored both goals, and every player got at least 25 minutes.";

function RecapScene({ t, pin }) {
  const answer = ANSWER.slice(0, Math.max(0, Math.floor((t - 5600) / 28)));
  return <div className="wt-scene">
    <div className="wt-panel wt-scorecard" style={box(4, 5, 92, 32)}>
      <div className="wt-team"><span className="wt-mark">RF</span>Riverside FC</div>
      <div className="wt-final"><span>2<em>–</em>1</span>{pin(0)}<small className={cx(t >= 600 && "on")}>Maya Torres 12', 31' · Full-time</small></div>
      <div className="wt-team"><span className="wt-mark opp">NU</span>Northside United</div>
    </div>
    <div className="wt-panel wt-minutes" style={box(4, 41, 56, 54)}>
      <div className="wt-panel-head"><strong>Minutes played</strong>{pin(1)}</div>
      {MINUTES.map(([name, minutes], index) => <div key={name} className="wt-stat">
        <span>{name}</span>
        <span className="wt-bar"><i style={{ width: t >= 1500 ? `${minutes * 2}%` : "0%", transitionDelay: `${index * 120}ms` }} /></span>
        <b>{t >= 1500 ? minutes : 0}</b>
      </div>)}
    </div>
    <div className="wt-panel wt-assistant" style={box(63, 41, 33, 54)}>
      <div className="wt-panel-head"><strong>Ask TeamTrack</strong>{pin(2)}</div>
      <span className={cx("wt-question", t >= 5000 && "on")}>Summarize this match</span>
      <p className="wt-answer">{answer}{t >= 5600 && answer.length < ANSWER.length && <i className="wt-caret" />}</p>
    </div>
  </div>;
}

const STEPS = [
  {
    nav: "Roster", label: "Build your roster", title: "Start with your players",
    body: "Add everyone once. Positions, jersey numbers, and availability carry through to lineups and match day.",
    callouts: [
      { at: 0, text: "Add a player with a name, jersey number, and the positions they can play." },
      { at: 3800, text: "Mark players unavailable and they're left out of lineups and substitutions." },
      { at: 6200, text: "Co-ed teams set how many girls must be on the field, and TeamTrack enforces it." },
    ],
    Scene: RosterScene,
  },
  {
    nav: "Lineups", label: "Set the lineup", title: "Plan who starts where",
    body: "Pick a format and formation, then place players on the field before you get to the game.",
    callouts: [
      { at: 0, text: "Choose 7v7, 9v9, or 11v11 and a formation." },
      { at: 1200, text: "Drag players from the bench onto the field, or auto-fill by preferred position." },
      { at: 5600, text: "Save it, then pick the lineup when you set up a match." },
    ],
    Scene: LineupScene,
  },
  {
    nav: "Matches", label: "Run match day", title: "Track the game as it happens",
    body: "The live screen keeps the clock, the score, and every player's minutes so you can focus on coaching.",
    callouts: [
      { at: 0, text: "The clock and each player's time on the field run automatically." },
      { at: 2600, text: "Record goals, assists, and cards with a tap." },
      { at: 4500, text: "Alerts flag who's due for a rest. One tap makes the substitution." },
    ],
    Scene: LiveScene,
  },
  {
    nav: "Matches", label: "Review the result", title: "See how it went",
    body: "Every match gets a recap with the score, scorers, and minutes played, plus an assistant you can ask about it.",
    callouts: [
      { at: 0, text: "The final score and goal scorers are saved automatically." },
      { at: 1500, text: "Minutes played for every player, so you can keep playing time fair." },
      { at: 5000, text: "Ask the match assistant for a quick summary." },
    ],
    Scene: RecapScene,
  },
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
}

export function Walkthrough() {
  const [index, setIndex] = useState(0);
  const [t, setT] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const elapsed = useRef(0);
  const section = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  const running = visible && !hovered && !userPaused && !reduced;
  useEffect(() => {
    if (!running) return undefined;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      elapsed.current += now - last;
      last = now;
      if (elapsed.current >= DURATION) {
        elapsed.current = 0;
        setIndex((current) => (current + 1) % STEPS.length);
      }
      setT(Math.floor(elapsed.current / 50) * 50);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);

  function select(next) {
    elapsed.current = 0;
    setT(0);
    setIndex(next);
  }

  const step = STEPS[index];
  const time = reduced ? DURATION : t;
  const active = step.callouts.reduce((found, callout, at) => (time >= callout.at ? at : found), -1);
  const pin = (at) => <span className={cx("wt-pin", at <= active && "on", at === active && "active")} aria-hidden="true">{at + 1}</span>;
  const Scene = step.Scene;

  return <section className="walkthrough" id="how-it-works" ref={section} aria-labelledby="walkthrough-title">
    <div className="walkthrough-head">
      <h2 id="walkthrough-title">How TeamTrack works</h2>
      <p>A typical week with your team, from building the roster to reviewing the result.</p>
    </div>
    <div className="walkthrough-body">
      <ol className="wt-steps" role="tablist" aria-label="Walkthrough steps">
        {STEPS.map((item, at) => <li key={item.label}>
          <button type="button" role="tab" aria-selected={at === index} aria-controls="walkthrough-stage"
            className={cx("wt-step", at === index && "active", at < index && "done")} onClick={() => select(at)}>
            <span className="wt-step-num">{at + 1}</span>
            <span><strong>{item.label}</strong><small>{item.body}</small></span>
            {at === index && !reduced && <span className="wt-step-progress" style={{ width: `${(t / DURATION) * 100}%` }} />}
          </button>
        </li>)}
      </ol>
      <div className="wt-stage" id="walkthrough-stage" role="tabpanel" aria-label={step.title}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="wt-stage-head">
          <h3>{step.title}</h3>
          {!reduced && <button type="button" className="button ghost small" onClick={() => setUserPaused((value) => !value)}>{userPaused ? "Play" : "Pause"}</button>}
        </div>
        <div className="wt-window" aria-hidden="true">
          <div className="wt-chrome">
            <span className="wt-brand"><i className="brand-mark" />TeamTrack</span>
            {NAV.map((item) => <span key={item} className={cx("wt-nav", item === step.nav && "active")}>{item}</span>)}
          </div>
          <div className="wt-canvas"><Scene key={index} t={time} pin={pin} /></div>
        </div>
        <ol className="wt-callouts">
          {step.callouts.map((callout, at) => <li key={callout.text} className={cx("wt-callout", at <= active && "on", at === active && "active")}>
            <b>{at + 1}</b><span>{callout.text}</span>
          </li>)}
        </ol>
      </div>
    </div>
  </section>;
}
