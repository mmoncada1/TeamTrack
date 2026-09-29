# TeamTrack Jac migration

This directory contains the in-progress Jac rewrite. The existing TypeScript
application remains the behavior reference until feature parity is reached.

## Run

```bash
cd jac_app
jac install
jac run --dev
```

Open <http://localhost:8000>.

## Verify

```bash
jac check
jac test domain/timer.jac
```

