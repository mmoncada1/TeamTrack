# TeamTrack Jac Migration History

Last updated: October 6, 2026

## Objective

Rewrite the existing TeamTrack React/TypeScript application in Jac while
preserving its functionality and behavior. The TypeScript application remains
in place as the reference implementation until the Jac version reaches feature
parity.

The Jac implementation lives in `TeamTrack/jac_app/`. Executable application
source is written in `.jac` files. Project configuration and styles remain in
their required non-Jac formats.

## Important product decisions

- Preserve TeamTrack's local-first behavior. No account or shared server
  database has been introduced.
- Teams, players, active-team selection, saved lineups, matches, settings, and
  whiteboards persist in browser `localStorage`.
- Keep the original TypeScript application untouched while migration work is
  underway.
- Use Jac's file-based routing. Do not introduce a manual router alongside the
  `pages/` directory.
- Use the installed Jac version, `0.37.23`.
- The Jac CLI in this environment uses `jac run --dev`; the older `jac start`
  command has been removed.

## Migration progress

Estimated overall completion: **about 95% for the soccer application**.

### Slice 1: Jac foundation

Completed:

- Created the Jac web project and dependency configuration.
- Added the application shell and all routes from the TypeScript app.
- Ported the core TeamTrack domain model.
- Ported all 14 supported formations and their exact field coordinates.
- Ported the timestamp-based match clock.
- Added Jac tests for formations and clock behavior.
- Verified the production build and basic SPA route fallback.

### Slice 2: teams and roster

Completed:

- Added shared reactive application state using a Jac client context.
- Added browser-local persistence and automatic creation of `My Team`.
- Added active-team persistence and switching.
- Added team creation, renaming, co-ed settings, and deletion.
- Added cascading roster deletion when a team is deleted.
- Added player creation, editing, deletion, search, and position filtering.
- Added multiple preferred positions, availability, notes, optional jersey
  numbers, co-ed gender fields, validation, and jersey sorting.

Known difference:

- Team and player photos are supported and included in backups, but are stored
  as browser-local data URLs rather than compressed binary records in the
  original Dexie/IndexedDB repository.

### Slice 3: saved lineups

Completed:

- Added persistent saved lineups scoped to a team.
- Added lineup creation, editing, renaming, and deletion.
- Added format and formation selection for 7v7, 9v9, and 11v11.
- Added preference-based automatic formation filling.
- Added manual player-to-slot assignment, occupant swapping, and bench removal.
- Added co-ed minimum-girls enforcement during automatic and manual placement.
- Added lineup cascading when a team is deleted.
- Added live roster and saved-lineup counts to the dashboard.
- Added a responsive field visualization.

- Added drag-and-drop between the bench and formation slots while retaining the
  accessible select controls for manual assignment.

### Slice 4: match drafts and setup

Completed:

- Added persistent draft matches scoped to a team.
- Added draft creation from the active team, current roster, default formation,
  and standard playing-time thresholds.
- Added draft deletion and cascading match deletion when a team is deleted.
- Added setup validation for metadata, formats, formations, match duration,
  capacity, duplicate assignments, and roster membership.
- Built `/match/new` and `/match/:id/setup` with match metadata, format,
  formation, timing, thresholds, goalkeeper rotation, sound, availability,
  saved-lineup application, automatic filling, manual assignments, and co-ed
  enforcement.
- Built the first match-history view for unfinished drafts.

### Slice 5: live matches, summaries, settings, and whiteboard

Implemented and verified:

- Added a pure event-sourced live match engine that rebuilds current state from
  timestamped match events.
- Added start, pause, resume, halftime, second-half, end-match, and reset
  lifecycle actions.
- Added player moves, substitutions, position swaps, formation-aware field
  state, unavailable/injured handling, red-card removal, and late player joins
  in the domain engine.
- Added goals, optional scorers and assists, opponent goals, own goals, cards,
  and match notes as persisted events.
- Added derived score, match clock, player status, field/bench intervals,
  substitutions, goals, assists, and playing-time totals.
- Enabled setup validation and **Start match**, which now transitions into the
  live route.
- Built `/match/:id/live` with a live clock, score, lifecycle controls, field
  assignments, bench, goals, cards, notes, event log, and reset workflow.
- Expanded `/matches` into history sections for in-progress matches, unfinished
  setup, and completed results, with status-aware routing.
- Built `/match/:id/summary` with final score, player playing-time statistics,
  goal/assist and substitution totals, event timeline, and player-summary CSV
  export.
- Replaced the settings placeholder with persistent dark-theme, reduced-motion,
  field-lock, and alert-sound preferences.
- Replaced the whiteboard placeholder with a per-team tactics board supporting
  pointer/touch drawing, colors, stroke widths, erasing, undo, clear, text
  notes, and browser-local persistence.
- Added domain coverage for live event replay, lifecycle validation, movements,
  scoring, cards, player availability, statistics, and event descriptions.

### Slice 6: soccer parity pass

Implemented and verified:

- Added playing-time alerts, substitution recommendations, alert sound,
  snooze/dismiss controls, goalkeeper rotation, and persisted field locking.
- Added action-level undo plus goal/note correction and deletion.
- Added complete JSON backup validation, export/import, demo roster loading,
  and full local-data reset.
- Added team and player photo selection, previews, removal, roster avatars, and
  dashboard team imagery.
- Matched the original dashboard's in-progress resume banner and completed
  match count.
- Applied dark theme and reduced-motion preferences at the application root so
  they remain active on every route.
- Restored the original field icon through Jac's asset bundle and aligned key
  soccer copy, scrolling, and layout behavior with the reference application.

## Current application status

### Functional Jac routes

- `/` — dashboard and active-team overview
- `/roster` — roster management
- `/lineups` — saved-lineup management and formation editor
- `/matches` — draft, live, and completed match history
- `/match/new` — draft creation and setup redirect
- `/match/:id/setup` — match configuration and starting-lineup setup
- `/match/:id/live` — live clock, field, score, actions, and event log
- `/match/:id/summary` — results, player statistics, timeline, and CSV export
- `/team/settings` — active-team settings
- `/settings` — device appearance and match-control preferences
- `/whiteboard` — persistent per-team tactics board

There are no remaining routed placeholder pages.

## Verification status

Verified after the October 6 soccer parity pass:

- `jac test -v` passes with **138 tests**.
- Jac server/client compilation succeeds, and a direct Vite production bundle
  succeeds with **225 modules transformed**. In this workspace, the outer
  `jac build` command stalls after handing off to the client bundler even though
  invoking that generated bundle directly succeeds.
- The original TypeScript reference application still passes `npm run build`.
- `git diff --check` passes.
- HTTP smoke tests return `200` for **eight representative routes**, including
  dashboard, roster, matches, live-match, summary, settings, and whiteboard
  surfaces.

Run verification from `TeamTrack/jac_app`:

```bash
jac test -v
jac build
```

Run the development server:

```bash
cd TeamTrack/jac_app
jac install
jac run --dev
```

The default application URL is `http://localhost:8000`.

## Current Jac architecture

### Entry and routing

- `main.jac` imports global CSS and mounts `AppStateProvider` around the
  file-based router.
- `pages/layout.jac` provides the global navigation shell and team switcher.
- Public functions returning `JsxPage` inside `pages/` become routes by file
  convention.

### State and persistence

- `state/AppState.jac` owns reactive teams, players, lineups, matches, and
  active-team state.
- `state/storage.jac` reads and writes browser `localStorage`.
- Settings and whiteboards use their own browser-local keys; whiteboards are
  scoped by team.
- Client context callbacks are stored in a dictionary. Consumers invoke stored
  callbacks with `.call(None, ...)`, which is required for reliable Jac-to-JS
  callback interoperation.

### Pure domain logic

- `domain/models.jac` — shared records
- `domain/formations.jac` — formation definitions and lookup
- `domain/timer.jac` — timestamp-based clock helpers
- `domain/roster.jac` — roster validation, normalization, and sorting
- `domain/lineups.jac` — assignments, automatic filling, and co-ed checks
- `domain/matches.jac` — draft creation and match-setup validation
- `domain/live_match.jac` — event creation, lifecycle actions, and state replay
- `domain/stats.jac` — score, playing-time summaries, and event descriptions

Pure behavior remains outside page components so it can be tested through
Jac's native test runner.

## Known technical issues and lessons

### Workspace patch helper

During this session, the patch helper could create files but intermittently
failed when opening existing files with:

```text
error building bubblewrap command: mountinfo path is not absolute
```

Existing files were narrowly moved to temporary backup paths and then recreated
through the patch mechanism. No original TypeScript source was removed or
overwritten.

### Jac syntax and compiler details

- Jac lambdas use braced bodies, for example
  `lambda (item: Team) { item.name.lower(); }`.
- Tuple loop targets require parentheses, and generic collection return types
  need explicit element types.
- Browser constructors use Jac's `new(target, ...args)` ambient builtin.
- Numeric HTML `min` and `max` attributes currently need string values in
  checked JSX, such as `min="1"`.
- Cross-module client helpers must be exposed with `:pub` or `:protect`.
- A `.test.jac` annex sees its base module's imports automatically. Repeating
  an import can produce duplicate JavaScript imports during client builds.
- Scoped `*.style.css` annexes were unreliable under Jac 0.37.23, so route
  styles use explicit CSS imports.

## Remaining migration work

The soccer workflows now have functional parity. Remaining work is limited to:

1. Match the original Dexie/IndexedDB image compression and binary-storage
   implementation. The current data-URL implementation has the same user-facing
   controls but reaches browser `localStorage` limits sooner on large rosters.
2. Add browser-level regression tests and screenshot comparisons for all soccer
   routes, especially mobile layouts and long-running live matches.
3. Resolve or work around the Jac 0.37.23 outer build-process stall; the
   generated Vite bundle itself builds successfully.

## Recommended next slice

Add browser automation for the migrated soccer flows, then decide whether exact
IndexedDB storage parity is worth the additional implementation complexity.

## Git status note

Migration work is on the `jac_migration` branch. Generated `.jac/`,
`node_modules/`, and `dist/` content is ignored by `jac_app/.gitignore`.
