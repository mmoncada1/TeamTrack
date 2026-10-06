# TeamTrack

TeamTrack is a local-first coaching app for soccer and **7v7 flag football**. Manage multiple teams on one device with separate rosters and sport-specific navigation. Choose Soccer or Football when creating a team; its sport is fixed afterward. Existing teams and older backups default to soccer.

## Soccer

- Rosters with jersey numbers, position preferences, availability, notes, and photos.
- Saved 7v7, 9v9, and 11v11 lineups, formations, and drag-and-drop assignments.
- Match setup, live clock, substitutions, playing-time recommendations, goals, assists, disciplinary events, match history, and summaries.
- Co-ed minimum-player rules and CSV playing-time exports.
- Tactical pitch whiteboard with pen, eraser, notes, lines, arrows, undo, and redo.

## Football

The workflow is **Roster → Formations → Playbook → Play editor → Drive plans → Whiteboard**.

Football models seven offensive slots with exactly one QB and a different designated snapper. Labels and other roles are flexible: the snapper can release or block, and other players can receive, run, or block. Football rosters do not impose soccer or NFL position conventions.

### Formations and play editor

Create a formation, drag seven players, optionally assign roster players, designate the QB and snapper, and save. **Autofill from roster** fills empty slots with available players by jersey number while keeping existing assignments; it also works in the play editor and can be undone. With fewer than seven available players, it fills as many slots as possible. Selected tokens also move with arrow keys. A formation becomes an independent snapshot when used for a play, so later formation edits do not change saved plays.

Click **New play** in the playbook, enter a name, and choose **Starting formation** in the creation dialog. It previews the selected formation and copies its positions, roster assignments, QB, and snapper into the new play. Choose **Default spread (start from scratch)** for a blank lineup, or create a play directly from a formation card. You can also load a starter concept. Select a player on the field or in the assignment panel. Routes include Go/Fly, Slant, Out, In/Dig, Post, Corner, Curl/Comeback, Hitch, Flat, Wheel, Drag, Crossing, Seam, Custom, Block, and Stay.

Assigned players show their roster photos and names on formations, plays, playbook previews, and drive previews. Role badges stay visible over the photos. Players without uploaded pictures show their initials; unassigned slots show their role labels.

- Flip left/right, rotate, or adjust depth without discarding edited geometry.
- Drag route control points. **Draw route points** extends a path through field clicks; **Remove last point** shortens it.
- **Add / edit motion** creates a separate pre-snap path with draggable points.
- Set the snapper's route or block independently of the snap.
- Add ordered passes, handoffs, pitches/laterals, and fake exchanges. Pick sender/recipient and **Place target** visually; otherwise actions target the recipient's route endpoint.
- Annotate with pen, line, arrow, erase, undo/redo, and clear. Erase removes whole annotations. Drawings save with the play.
- Edit name, notes, and comma-separated tags, then **Save play**. Back asks before discarding edits; browser unload warns about unsaved work.

Gold = QB; blue = snapper. Purple dashed paths show motion; labelled colored lines show ball actions. The tactical field includes yard references, a line of scrimmage, an end zone, and offensive direction. These are tactical references, not a league-certified field layout.

The playbook supports previews, search by names/notes/tags, tag filters, duplication, renaming in the editor, and deletion. Deleting a play removes its drive entries. Deleting a roster player clears their football assignments and preserves the art.

### Starter concepts and provenance

The 15 starters are Four Verticals, Mesh, Slants, Smash, Flood, Levels, Stick, Drive, Shallow Cross, Curl/Flat, Post/Wheel, Spacing, Quick Screen, Jet Motion Handoff, and Basic Pitch. They are original structured definitions adapting common concepts to seven players. No Madden, NFL, or college diagrams or third-party dataset were copied.

This approach distinguishes common concepts from a publisher's particular expression; see the [U.S. Copyright Office's explanation of ideas, methods, and systems](https://www.copyright.gov/circs/circ33.pdf). Future datasets should have verified reuse rights and be adapted to `PlayTemplate` definitions. The editor consumes ordinary editable play data independently of the template source.

### Drive planner and whiteboard

Create named call sheets from saved plays. Add, remove, repeat, and reorder calls; preview each and step through with Previous/Next. Repeated calls have distinct entry IDs. Save drives separately from matches.

The blank football whiteboard saves automatically, including undo/redo changes. It is separate from formal plays and the soccer pitch and shares drawing primitives with them.

### Current scope

Football supports offensive play design and drive plans. Defensive formations, 11-man tackle, animated execution, timed possession simulation, and football match/stat tracking are future work. Ordered action beats and separate motion paths leave room for sequencing. Adapt blocking, eligibility, handoffs, and pitches to your league's rules.

## Development

Use Node.js 22+ and npm:

```sh
npm ci
npm run dev
```

No backend, API credentials, or account is required. The app uses React, TypeScript, React Router, Zustand, Dexie, Tailwind, and dnd-kit. Football pages load on demand.

## Persistence and backups

Dexie database `teamtrack`, schema version **5**, stores teams, roster players/photos, soccer lineups/matches, football formations/plays, drive plans, and football whiteboards. The upgrade adds football tables and stamps existing teams as soccer without replacing soccer records.

Plays are JSON-compatible data: starting positions, relative route/motion points, roles, ordered ball actions/targets, tags, and drawing strokes. Validation checks seven slots, distinct QB/snapper, unique assignments, finite geometry, and valid references. Repository operations also verify sport and roster ownership.

**Settings → Export JSON backup** exports all IndexedDB collections and app settings using backup version **6**. Older soccer backups import with empty football collections. Malformed football records, unsupported versions/sports, duplicate football IDs, and cross-team references reject import before replacement. Restore replaces IndexedDB collections in one transaction; photos convert between blobs and data URLs.

App preferences, active team selection, and the existing soccer whiteboard use localStorage. The soccer whiteboard remains outside JSON backup; football whiteboards and play drawings are included. Data is browser/device-specific: export backups before clearing storage or moving devices. Match CSV exports remain soccer-specific; use JSON for football geometry.

## Architecture

| Module                                                          | Responsibility                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/lib/sports.ts`, `src/types/index.ts`                       | Sport identity, legacy default, shared team/roster types                            |
| `src/components/layout/SportBoundary.tsx`, `AppShell.tsx`       | Sport routing, URL guards, navigation                                               |
| `src/football/types.ts`                                         | Formation, assignment, route, action, play, template, drive types                   |
| `src/football/routes.ts`, `domain.ts`, `validation.ts`          | Pure geometry, snapshots, template instantiation, duplication, ordering, validation |
| `src/football/templates.ts`                                     | Original portable starter definitions                                               |
| `src/football/repository.ts`, `backup.ts`, `useFootballData.ts` | Persistence, backup validation, team-scoped reactive queries                        |
| `src/football/FootballField.tsx`, `FootballEditor.tsx`          | Field rendering and interactive formation/play editing                              |
| `src/football/*Page.tsx`, `FootballDashboard.tsx`               | Football workflows                                                                  |
| `src/drawing/`                                                  | Shared pointer/path geometry, layers/toolbars, immutable history                    |
| `src/db/`, `src/lib/exportImport.ts`                            | Migrations, deletion/restore transactions, JSON/CSV exports                         |

## Checks

```sh
npm test             # Full Vitest suite, including soccer regressions
npm run test:watch   # Watch mode
npm run build        # TypeScript project checks + production Vite build
npm run lint         # ESLint
npm run preview      # Serve production build
npm run test:browser # Real headless Chromium smoke checks
```

Browser checks require Chrome/Edge, or `CHROME_PATH` pointing to Chromium. They use Node's built-in WebSocket client, an isolated Vite server on port 5179, and a temporary profile, without accessing normal browser data. They check player/route dragging, motion, ball targets, annotations, reload persistence, drive repetition, whiteboard history, small-screen layout, and soccer navigation/setup. Screenshots go to a temporary artifacts directory printed by the script.

Vitest uses fake IndexedDB and jsdom. Coverage includes a real Dexie v4→v5 migration, formation validation, geometry transformations, template independence, drive ordering, backup restore, ownership, deletion cascades, and editor workflows. Existing soccer match/clock/recommendation tests remain in the suite. Eight pre-existing ESLint warnings and React Router v7 notices in the older soccer tests remain.
