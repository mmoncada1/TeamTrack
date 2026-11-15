import React, { useEffect, useRef, useState } from "react";

export function TeamMenu({ teams, activeId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const root = useRef(null);
  const button = useRef(null);
  const list = useRef(null);
  const active = teams.find((team) => team.id === activeId);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    list.current?.focus();
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function show() {
    setHighlighted(Math.max(0, teams.findIndex((team) => team.id === activeId)));
    setOpen(true);
  }

  function choose(team) {
    setOpen(false);
    button.current?.focus();
    onSelect(team.id);
  }

  function onListKey(event) {
    if (event.key === "ArrowDown") { event.preventDefault(); setHighlighted((at) => Math.min(teams.length - 1, at + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setHighlighted((at) => Math.max(0, at - 1)); }
    else if (event.key === "Home") { event.preventDefault(); setHighlighted(0); }
    else if (event.key === "End") { event.preventDefault(); setHighlighted(teams.length - 1); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(teams[highlighted]); }
    else if (event.key === "Escape" || event.key === "Tab") { setOpen(false); if (event.key === "Escape") button.current?.focus(); }
  }

  return <div className="team-menu" ref={root}>
    <button ref={button} type="button" className="team-menu-button" aria-haspopup="listbox" aria-expanded={open} aria-label={`Active team: ${active?.name || "none"}`}
      onClick={() => (open ? setOpen(false) : show())}
      onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(); } }}>
      <span className="team-menu-label">{active?.name || "Select team"}</span>
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && <ul ref={list} className="team-menu-list" role="listbox" tabIndex={-1} aria-label="Teams"
      aria-activedescendant={teams[highlighted] ? `team-option-${teams[highlighted].id}` : undefined} onKeyDown={onListKey}>
      {teams.map((team, at) => <li key={team.id} id={`team-option-${team.id}`} role="option" aria-selected={team.id === activeId}
        className={`team-menu-option${at === highlighted ? " highlighted" : ""}`}
        onMouseEnter={() => setHighlighted(at)} onClick={() => choose(team)}>
        <span>{team.name}</span>
        {team.id === activeId && <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 6.5 5 9 9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </li>)}
    </ul>}
  </div>;
}
