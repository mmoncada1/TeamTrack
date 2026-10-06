# TeamTrack Jac migration plan

Updated: October 6, 2026. Working branch: `jac_migration` (football TypeScript merged locally).

## Progress ledger

| Stage | Status | Completion evidence | Next action |
| --- | --- | --- | --- |
| 0. Baseline and plan | Complete | TypeScript: 79 tests and build pass. Jac: 130 domain tests, `jac build --check_only`, and production `jac build` pass after `jac clean --cache --force`. Jac dev server serves the summary route (HTTP 200). | Keep checks green after each slice |
| 1. Finish soccer Jac | Implemented, verification pending | Live alerts, field lock/timers, co-ed moves, player availability, goal correction, drag/drop, whiteboard tools, backup validation/demo/reset. 133 Jac tests and clean `jac build` pass after photo rollback. Headless browser check cannot run: Chrome/Chromium is absent. | Run browser interaction checks when Chromium is available; complete shared backup import in stage 5 |
| 2. Football Jac domain | In progress | Seven-slot model, formation/play/drive validation and pure operations added; 4 focused tests pass. Route geometry and templates remain. | Port routes/geometry and starter templates |
| 3. Football Jac storage and sport shell | In progress | Sport on teams; football collections and team-scoped callbacks; sport-aware team creation, roster and navigation added. Full build pending. | Verify persistence and complete route guards |
| 4. Football Jac workflows | In progress | Formation list/editor with roster assignment, QB/snapper, autofill and field drag added; browser verification pending. | Port playbook/editor, drives, whiteboard |
| 5. Shared persistence transition and photos | Pending Supabase design | Current Jac uses localStorage; TypeScript uses Dexie. No temporary Jac photo storage will be added. | Define schema, auth, RLS, TypeScript v6 and Jac backup imports, and Supabase Storage photo path before cutover |
| 6. Parity verification and cutover | Not started | — | Run domain, build and browser checks for both sports |

Update this table after each verified slice. Do not mark a stage complete based on code alone; include test/build or browser evidence. A partial migration remains runnable and keeps the TypeScript app as a reference.

## Stage 1: soccer parity checklist

- [x] Live playing-time alerts and substitution recommendations, including snooze/dismiss, alert tone, and goalkeeper rotation. Domain tests pass; browser interaction verification pending.
- [x] Live settings and field lock applied to movement controls, including co-ed rules. Browser interaction verification pending.
- [x] Event editing/deletion and undo controls, including completed-match goal and own-goal correction. Domain tests pass; browser interaction verification pending.
- [x] Jac JSON backup export/import with structural validation, demo data and scoped reset. TypeScript backup import belongs to the shared data transition in stage 5.
- [ ] Team/player photo persistence and display: **deferred to the Supabase migration**. Use Supabase Storage; do not add temporary local or JSON photo storage in Jac.
- [x] Drag and drop for lineup, setup and live field assignments; selects remain the keyboard/touch fallback. Browser interaction verification pending.
- [ ] Browser interaction checks for roster, setup, live match, summary, whiteboard and recovery after reload. `jac browse` cannot start here because Chrome/Chromium is absent.

Use `src/pages/`, `src/lib/`, `src/components/match/`, and their tests as the soccer behavior reference. Recheck `MIGRATION_HISTORY.md`: several features recorded as remaining already have domain helpers or partial UI; verify before reimplementing.

## Stages 2–4: football migration slices

1. **Sport boundary and data model.** Add immutable `sport` on teams (legacy teams default to soccer), sport-aware navigation and route guards. Port `src/lib/sports.ts`, `src/football/types.ts`, `domain.ts`, and `validation.ts`. Preserve seven offensive slots, distinct QB/snapper, unique roster assignments, finite geometry, team ownership and deletion cascades.
2. **Football storage.** Add team-scoped formations, plays, drive plans, and whiteboards. Keep data compatible with the future Supabase schema; document one-time import from TypeScript backup version 6 and Jac local data. Verify save/reload, duplicate, rename and cascade behavior.
3. **Formations.** Port creation/editing, drag and keyboard movement, player photos, autofill, QB/snapper controls and independent snapshots. Compare with `src/football/FormationsPage.tsx`, `FootballEditor.tsx` and football tests.
4. **Playbook and play editor.** Port starter templates, creation from a formation, routes and motion paths, control points, ball actions and targets, drawings, tags/search, duplication and unsaved-change prompts. A saved play must not change when its source formation changes.
5. **Drive plans and whiteboard.** Port ordered and repeated play calls with distinct entry IDs, preview navigation, persistent drawings, undo/redo, and sport-separated whiteboards.

The feature contract is in root `README.md`; the TypeScript implementation and tests under `src/football/` are the detailed reference. Football currently covers offensive play design and drives, not football matches or statistics.

## Verification gates

- Root TypeScript reference: `npm test`, `npm run build`, `npm run test:browser` (when Chromium is available).
- Jac, from `jac_app/`: `jac check`, `jac test -v`, `jac build`, then exercise routes in a browser after reload.
- For each football slice, compare fixtures and outcomes with the TypeScript tests. Verify sport isolation and legacy soccer teams.
- Before switching persistence, test empty account, existing Jac localStorage, and TypeScript version 6 backup imports. Confirm ownership/RLS behavior if Supabase is adopted.

## Resume point

Read the progress ledger and latest Git diff, then continue football stage 2. Soccer's remaining browser interaction gate should run when Chrome/Chromium is available. TypeScript backup import and photo persistence/display belong to the Supabase transition and must be completed before final cutover. Supabase credentials or project setup are not required for other Jac features.
