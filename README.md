# TeamTrack

TeamTrack is a local-first team management app built with Jac.

## Run locally

Install Jac 0.37.23, then run these commands from the TeamTrack folder:

```bash
jac install
jac run --dev
```

Open http://localhost:8000. App data is stored in the browser's local storage.

## Supabase schema

The SQL migration in [`supabase/migrations/20261007000000_initial_teamtrack.sql`](supabase/migrations/20261007000000_initial_teamtrack.sql) creates tables for teams, roster players, lineups, matches, statistics, and events for soccer and football. Apply it to a Supabase project with the Supabase CLI or SQL editor. It uses Supabase Auth user IDs for team ownership and enables row level security on every table. A signed-in user can access only teams they own and their related records. Profile picture fields hold a Storage path or URL; no Storage bucket is created by this migration.

The application still uses browser local storage. Connecting its state to Supabase, adding sign-in and team membership, migrating existing browser IDs to UUIDs, and synchronizing event totals with statistics are follow-up work. Applying this schema alone does not move existing browser data or make it available across devices.

## Verify

```bash
jac check
jac test -v
jac build
```

The build writes `dist/teamtrack.jab`. Run it with `jac run dist/teamtrack.jab`.

See [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for the migration record. Deployment requires a host that runs the Jac web server; a static site host cannot serve this application by itself.
