# KhayaBeats Home Music Server (Windows)

Your Windows PC is the music server. YouTube trusts home internet connections far
more than cloud servers (Render, VPS), which is why it always worked on your PC.
Tailscale Funnel gives the PC a free, permanent `https://....ts.net` address so the
website and the Android app can reach it from anywhere - no router changes.

```text
Phone / website  ->  KhayaBeats cloud function  ->  signed link  ->  Tailscale Funnel  ->  your PC (port 3001)  ->  yt-dlp
```

## One-time setup

1. On GitHub, open the KhayaBeats repository > **Code** > **Download ZIP**, then extract it
   (for example to `C:\KhayaBeats`). Or `git clone` it.
2. Create a free account at https://tailscale.com (Google sign-in is fine).
3. Open `khayabeats-server\windows` and double-click **INSTALL.bat**. Click **Yes** when Windows asks.
   It installs Node.js, Tailscale, FFmpeg and yt-dlp, creates your private key, signs you in to
   Tailscale, turns on the public address, stops the PC from sleeping on mains power, and adds
   the server to Windows startup.
4. If Tailscale shows a link to **enable Funnel / HTTPS**, open it and approve.
5. Notepad opens **SETUP-INFO.txt** with two values: the **address** and the **key**.
   Give both to the KhayaBeats app setup (the Lovable chat asks for them in a secure form).
   Never post the key or upload that file.

## Everyday buttons (in `khayabeats-server\windows`)

| File | What it does |
| --- | --- |
| `START.bat` | Starts the server (also runs automatically when Windows signs in). Keep its window open. |
| `STOP.bat` | Stops the server and closes the public address. |
| `STATUS.bat` | Checks the server, the YouTube test, and whether the internet can reach it. |
| `UPDATE.bat` | Updates yt-dlp (fixes most "YouTube changed something" errors). |
| `IMPORT-COOKIES.bat` | Loads an exported YouTube `cookies.txt` if YouTube starts asking for sign-in. |
| `UNINSTALL.bat` | Removes auto-start and the public address. |

## Keep in mind

- The PC must be **on, awake and online** for songs to play. Downloaded songs in the app still play offline.
- Songs are cached in `storage\music-cache`, so repeat plays are instant and save bandwidth.
- Capacity depends on your home upload speed. Fine for launch and early users.
- After pulling new code from GitHub: close the server window, run `UPDATE.bat`, then `START.bat`.

## Security

- The server only listens on `127.0.0.1`; the only way in from outside is the Tailscale address.
- Playback and downloads need a short-lived signed link created by the cloud function, so
  nobody can use your PC as a free download service by guessing URLs.
- Admin actions (cookies, diagnostics, self-test) need the private key.
- Requests are rate-limited per IP.

## Endpoints

| Endpoint | Access |
| --- | --- |
| `GET /health`, `GET /auth-status` | Public, no secrets |
| `GET /search`, `/artists/:id`, `/albums/:id`, `/cache/stats` | Public metadata |
| `GET /stream/:videoId`, `GET /offline/download/:videoId` | Signed link or key |
| `POST /audio-url`, `/self-test`, `/upload-cookies`, `/oauth-setup`, `/cache/cleanup`, `GET /diagnostics/recent`, `/cookies-status` | Key (`x-kb-key` header) |

## Other systems

Run `npm install && npm start` with `KB_SERVER_KEY` set in `.env`, and publish port 3001 with
`tailscale funnel --bg 3001`. yt-dlp must be on PATH or next to `server.js`.
