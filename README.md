# TeamTrack

TeamTrack is a local-first team management app built with Jac.

## Run locally

Install Jac 0.37.23, then run these commands from the TeamTrack folder:

```bash
jac install
jac run --dev
```

Open http://localhost:8000. App data is stored in the browser's local storage.

## Verify

```bash
jac check
jac test -v
jac build
```

The build writes `dist/teamtrack.jab`. Run it with `jac run dist/teamtrack.jab`.

See [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for the migration record. Deployment requires a host that runs the Jac web server; a static site host cannot serve this application by itself.
