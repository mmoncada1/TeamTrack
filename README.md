# TeamTrack

TeamTrack is a team management app built with Jac. Supabase Auth now gates the app and a private cloud snapshot saves its existing Jac state.

## Run locally

Install Jac 0.37.23, then run these commands from the TeamTrack folder:

```bash
jac install
jac run --dev
```

Open http://localhost:8000. Sign in or create an account. On first sign-in, choose whether to import data already in this browser. The app keeps a browser cache and saves it to the signed-in user's Supabase snapshot. Use **Sync now** before signing out if the connection has been interrupted.

## Supabase schema

The migrations in [`supabase/migrations/`](supabase/migrations/) create tables for teams, roster players, lineups, matches, statistics, and events for soccer and football, plus a private `profile-pictures` Storage bucket. Apply them to a Supabase project with the Supabase CLI. Storage object names must start with the owning team's UUID, such as `<team-id>/players/<player-id>.jpg`. The bucket accepts JPEG, PNG, WebP, and GIF images up to 2.5 MB. Team and Storage row level security currently grants access only to the signed-in team owner.

### Hosted project setup

The browser client is configured for project `agtdyrerqbuwfwimbttj` with its publishable key in [`state/cloud.js`](state/cloud.js). Apply all three SQL migrations before running the app:

```bash
npx supabase login
npx supabase link --project-ref agtdyrerqbuwfwimbttj
npx supabase db push --dry-run
npx supabase db push
```

The link command asks for the project's database password. In the Supabase Dashboard, set **Authentication → URL Configuration → Site URL** to `http://localhost:8000` for local testing, and enable the email provider. Hosted projects normally require email confirmation for new accounts. Add your deployed URL there when deploying.

New records use UUIDs, and the app rewrites older browser-generated IDs and references on startup. The cloud snapshot makes existing Jac state available across sessions after the user chooses to import it. Teams and roster players also sync into their normalized tables. Team and player photos upload to the private bucket; the cloud snapshot stores their Storage paths, and the app creates signed URLs when loading them. Lineups, matches, events, and statistics still persist through the snapshot rather than their individual tables. Team membership and event/statistics synchronization are pending.

## Verify

```bash
jac check
jac test -v
jac build
```

The build writes `dist/teamtrack.jab`. Run it with `jac run dist/teamtrack.jab`.

Deployment requires a host that runs the Jac web server; a static site host cannot serve this application by itself.
