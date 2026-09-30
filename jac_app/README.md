# TeamTrack Jac app

This directory contains the local-first Jac rewrite of TeamTrack. The original
React/TypeScript application one directory above remains the behavior reference
while the final parity items are completed.

## Run locally

Requires Jac `0.37.23`.

```bash
cd TeamTrack/jac_app
jac install
jac run --dev
```

Open <http://localhost:8000>.

All application data is stored in this browser's local storage. Use the same
browser profile when returning to an existing roster or match.

## Verify

```bash
jac check
jac test -v
jac build
```

The sealed application is written to `dist/teamtrack.jab` and can be launched
with:

```bash
jac run dist/teamtrack.jab
```

## Current functionality

- Teams, roster management, and co-ed rules
- Saved formations and lineups
- Match setup and persistent drafts
- Live match clock, lifecycle, field moves, substitutions, goals, cards, notes,
  and event replay
- Completed-match history, summaries, player statistics, and CSV export
- Team whiteboard with persisted drawings and notes
- Theme, motion, field-lock, and sound preferences

See `MIGRATION_HISTORY.md` for detailed parity status and remaining work.
