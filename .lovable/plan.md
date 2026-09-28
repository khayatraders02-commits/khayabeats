# Windows Home Music Server

## Goal
Replace Render with the existing Windows PC as the KhayaBeats music server, reachable by the published website and future Android app through a stable public HTTPS address.

## What I’ll build
- A Windows setup package inside the repository with one-click install, start, stop, status, update, and uninstall scripts.
- Automatic installation/checks for Node.js, yt-dlp, FFmpeg, and Tailscale.
- Tailscale Funnel startup on port 3001, with clear output showing the permanent public `https://*.ts.net` address.
- Start-on-login support so the server returns automatically after Windows restarts.
- Persistent local cache, cookies, logs, and diagnostics on the PC rather than temporary cloud storage.
- A setup guide covering the initial Tailscale sign-in, cookie export, GitHub download, and copying the public address into KhayaBeats.

## Security and reliability
- Require a private server key for playback, downloads, diagnostics, and cookie changes.
- Keep health checks public but remove public access to cookie and OAuth administration.
- Restrict browser access to approved KhayaBeats origins.
- Add request limits, safe input validation, and graceful shutdown.
- Keep secrets and `cookies.txt` outside GitHub.
- Add startup dependency updates and a self-test that verifies real audio extraction before declaring the server ready.

## App integration
- Replace Render-specific wording and defaults with a configurable home-server address.
- Route public playback through the existing protected cloud function so the private server key is never included in the website or Android app.
- Update offline downloads to use the same protected source and preserve content-type validation.
- Keep the current Capacitor Android path; no Android user needs Tailscale installed.

## Delivery and verification
- Test server startup, health, authentication rejection, diagnostics, and Windows script syntax locally where possible.
- Verify the web app still builds and that no Render URL remains as an active default.
- Provide the exact GitHub download-and-run steps and identify the two values that must be configured after Tailscale returns the public address.

## Important limits
- The PC must remain powered on, connected to the internet, and awake for users to play uncached music.
- This is free to start, but residential upload speed and the PC become the capacity limit; it is suitable for launch and early users, not unlimited scale.
- Bunny.net cannot extract YouTube audio. It can later serve audio you own or are licensed to distribute, reducing PC bandwidth.
