# TeamTrack Jac Migration History

Last updated: September 29, 2026

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
- Teams, players, active-team selection, and saved lineups currently persist in
  browser `localStorage`.
- Keep the original TypeScript application untouched while migration work is
  underway.
- Use Jac's file-based routing. Do not introduce a manual router alongside the
  `pages/` directory.
- Use the installed Jac version, `0.37.23`.
- The Jac CLI in this environment uses `jac run --dev`; the older `jac start`
  command has been removed.

## Migration progress

Estimated overall completion: **35–40%**.

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
- Added player creation, editing, and deletion.
- Added roster search and position filtering.
- Added multiple preferred positions, availability, notes, optional jersey
  numbers, and co-ed gender fields.
- Ported player validation, unique jersey-number enforcement, position
  normalization, and jersey sorting.

Not included in this slice:

- Team and player photo processing.
- IndexedDB storage parity with the original Dexie-based implementation.

### Slice 3: saved lineups

Completed:

- Added persistent saved lineups scoped to a team.
- Added lineup creation, editing, renaming, and deletion.
- Added format and formation selection for 7v7, 9v9, and 11v11.
- Added preference-based automatic formation filling.
- Added manual player-to-slot assignment, occupant swapping, and bench removal.
- Added co-ed minimum-girls enforcement during automatic and manual placement.
- Added lineup cascading when a team is deleted.
- Added live roster and saved-lineup counts to the Jac dashboard.
- Added a responsive field visualization.

Known difference:

- The original lineup editor supports drag-and-drop. The Jac editor currently
  uses a dropdown for each field position. Assignment behavior is present, but
  interaction parity is not complete.

## Current application status

### Functional Jac routes

- `/` — dashboard with active team, player count, and saved-lineup count
- `/roster` — roster management
- `/lineups` — saved-lineup management and formation editor
- `/team/settings` — active-team settings

### Routed placeholders

- `/matches`
- `/match/new`
- `/match/:id/setup`
- `/match/:id/live`
- `/match/:id/summary`
- `/whiteboard`
- `/settings`

## Verification status

At the end of the current session:

- `jac test -v` passes with **29 tests**.
- `jac build` succeeds and produces `dist/teamtrack.jab`.
- HTTP smoke tests return `200 text/html` for `/`, `/lineups`, `/roster`, and
  `/team/settings`.

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

- `state/AppState.jac` owns reactive teams, players, lineups, and active-team
  state.
- `state/storage.jac` reads and writes browser `localStorage`.
- Client context callbacks are stored in a dictionary. Consumers invoke stored
  callbacks with `.call(None, ...)`, which is required for reliable Jac-to-JS
  callback interoperation.

### Pure domain logic

- `domain/models.jac` — shared records
- `domain/formations.jac` — formation definitions and lookup
- `domain/timer.jac` — timestamp-based match clock
- `domain/roster.jac` — roster validation, normalization, and sorting
- `domain/lineups.jac` — assignment movement, automatic filling, and co-ed
  placement checks

Pure behavior is kept outside the page components so it can be tested through
Jac's native test runner.

## Known technical issues and lessons

### Workspace patch helper

During this session, the patch helper could create files but intermittently
failed when opening existing files with:

```text
error building bubblewrap command: mountinfo path is not absolute
```

Existing files were narrowly moved to temporary backup directories and then
recreated through the patch mechanism. No original TypeScript source was
removed or overwritten.

### Jac syntax and compiler details

- Jac lambdas use braced bodies, for example
  `lambda (item: Team) { item.name.lower(); }`.
- Tuple loop targets require parentheses:
  `for (key, value) in mapping.items()`.
- Tuple assignment also requires parentheses.
- `default` is a Jac keyword and cannot be used as an unescaped local variable.
- Numeric HTML `min` and `max` attributes currently need string values in
  checked JSX, such as `min="1"`.
- Cross-module client helpers must be exposed with `:pub` or `:protect`.
- A `.test.jac` annex sees its base module's imports automatically. Repeating
  an import can produce duplicate JavaScript imports during client builds.
- The scoped `lineups.style.css` annex did not emit its expected generated CSS
  file under Jac 0.37.23. The lineup page therefore uses an explicit
  `import "./lineups.css";`.

## Remaining migration work

Major missing functionality:

1. Match persistence and draft-match model
2. Match creation and setup validation
3. Applying saved lineups during match setup
4. Match event/action engine
5. Start, pause, resume, halftime, second half, and end workflows
6. Player moves, substitutions, and live formation changes
7. Goals, assists, cards, notes, event editing, deletion, and undo
8. Playing-time derivation and summaries
9. Playing-time alerts and substitution recommendations
10. Match history, filtering, results, and summary pages
11. JSON backup/restore and CSV export
12. Team and player photos, compression, and binary storage
13. Whiteboard drawing
14. Theme, sound, reduced-motion, and field-lock settings
15. Drag-and-drop parity for lineup and live-match field interactions
16. Remaining page and integration tests

## Recommended next slice

Implement match creation and match persistence:

- Extend browser persistence and `AppStateProvider` with matches.
- Port match-setup validation.
- Build `/match/new` and `/match/:id/setup`.
- Allow selecting roster players, format, formation, match duration, and saved
  lineups.
- Persist draft matches before starting them.
- Add pure Jac tests for match validation and draft creation.
- Update the dashboard and match-history placeholder to show draft matches.

This slice establishes the data boundary needed before porting the live match
event engine.

## Git status note

At the end of this window, `jac_app/` is a new, untracked directory in the
TeamTrack repository. Review and commit it when the migration checkpoint is
ready. Generated `.jac/`, `node_modules/`, and `dist/` content is ignored by
`jac_app/.gitignore`.
