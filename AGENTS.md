# Project rules

- Music extraction runs on the owner's Windows home PC (`khayabeats-server`), published via Tailscale Funnel; cloud hosts (Render/VPS) are not used because YouTube blocks datacenter IPs.
- The home server's private key (`KB_SERVER_KEY` on the PC, `KHAYABEATS_SERVER_KEY` in the cloud function) never ships to the web/Android app; the `get-audio-stream` function hands devices short-lived HMAC-signed `/stream` and `/offline/download` links instead.
- The app learns server status only through `get-audio-stream` (`action: "status"`), so the app never needs the home PC address or key.
- Windows server operation is via the double-click scripts in `khayabeats-server/windows/`; runtime secrets (`.env`, `cookies.txt`, `SETUP-INFO.txt`) are git-ignored.
