# Deploy JAM On Render

This is the fastest production path for JAM right now because it runs the Next app and the Python analyzer in the same container.

## Render settings

- Service type: `Web Service`
- Environment: `Docker`
- Branch: `main`
- Root Directory: leave blank
- Dockerfile Path: `Dockerfile`

## Why this path

The app already works locally because the Next route can call `scripts/analyze_song.py` directly. Hosting the whole app in one container keeps that same architecture in production and avoids:

- Vercel payload limits
- cross-origin upload issues
- separate frontend/backend coordination

## After deploy

Use the Render app URL as the shared tester link.
