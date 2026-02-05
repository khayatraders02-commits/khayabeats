# 🎵 KHAYABEATS Private Audio Server

A professional yt-dlp based audio streaming server for KHAYABEATS.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    KHAYABEATS SYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐         ┌──────────────────────┐         │
│   │   Users     │ ───────▶│   khayabeats-api     │         │
│   │  (Mobile/   │         │    (Port 3001)       │         │
│   │   Desktop)  │         │                      │         │
│   └─────────────┘         │  • Stream audio      │         │
│                           │  • Manage cache      │         │
│                           │  • Handle requests   │         │
│                           └──────────┬───────────┘         │
│                                      │                      │
│                                      ▼                      │
│                           ┌──────────────────────┐         │
│                           │   yt-engine          │         │
│                           │    (Port 3002)       │         │
│                           │                      │         │
│                           │  • Queue downloads   │         │
│                           │  • Run yt-dlp        │         │
│                           │  • Search YouTube    │         │
│                           └──────────────────────┘         │
│                                                             │
│   ┌──────────────────────────────────────────────────┐     │
│   │              storage/music-cache/                 │     │
│   │                                                   │     │
│   │  song1.mp3  song2.mp3  song3.mp3  ...            │     │
│   │                                                   │     │
│   │  (Cached songs - stream to thousands of users)   │     │
│   └──────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- yt-dlp installed

### Installation

1. **Install yt-dlp**

   Windows:
   ```bash
   # Download from https://github.com/yt-dlp/yt-dlp/releases
   # Place yt-dlp.exe in khayabeats-server/yt-engine/
   ```

   macOS/Linux:
   ```bash
   pip install yt-dlp
   # OR
   brew install yt-dlp
   ```

2. **Install dependencies**
   ```bash
   cd khayabeats-server
   npm install
   ```

3. **Start the servers**

   Terminal 1 (YT Engine):
   ```bash
   npm run engine
   ```

   Terminal 2 (Main API):
   ```bash
   npm start
   ```

## API Endpoints

### Main API (Port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/stream/:videoId` | GET | Stream audio |
| `/audio-url` | POST | Get stream URL |
| `/search?q=` | GET | Search YouTube |
| `/offline/download/:videoId` | GET | Download for offline |
| `/cache/stats` | GET | Cache statistics |

### YT Engine (Port 3002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Engine health |
| `/fetch` | POST | Download audio |
| `/search?q=` | GET | Search YouTube |
| `/queue` | GET | Queue status |

## How It Works

### Streaming Flow

1. User requests a song
2. API checks cache
3. If cached → stream immediately
4. If not cached:
   - Add to download queue
   - yt-dlp downloads audio
   - Save to cache
   - Stream to user

### Concurrent Handling

- Max 10 concurrent downloads
- Unlimited concurrent streams (from cache)
- Queue system prevents overload

### Cache Management

- Songs cached for 30 days by default
- Automatic cleanup runs hourly
- Max cache size: 50GB (configurable)

## Configuration

Edit `server.js` CONFIG object:

```javascript
const CONFIG = {
  CACHE_DIR: './storage/music-cache',
  TEMP_DIR: './storage/temp',
  YT_ENGINE_URL: 'http://localhost:3002',
  MAX_CACHE_SIZE_GB: 50,
  CACHE_CLEANUP_INTERVAL: 60 * 60 * 1000,
};
```

## Integration with KHAYABEATS App

Update your Supabase edge function to point to your server:

```typescript
// In supabase/functions/get-audio-stream/index.ts
const YOUR_SERVER_URL = 'http://YOUR_PC_IP:3001';

// Fetch audio
const response = await fetch(`${YOUR_SERVER_URL}/audio-url`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ videoId }),
});
```

## Production Deployment

For production, consider:

1. **VPS/Cloud Server**
   - DigitalOcean, Vultr, Linode
   - Minimum 2GB RAM, 50GB SSD

2. **Reverse Proxy**
   - nginx for SSL/HTTPS
   - Load balancing

3. **Process Manager**
   ```bash
   npm install pm2 -g
   pm2 start server.js --name kb-api
   pm2 start yt-engine/engine.js --name kb-engine
   ```

4. **Firewall**
   - Only expose port 3001
   - Keep 3002 internal

## Troubleshooting

### yt-dlp not found
```bash
# Check if installed
yt-dlp --version

# Download manually for Windows
# https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
```

### Permission errors
```bash
# Linux/Mac
chmod +x yt-engine/yt-dlp
```

### Download failures
- Check internet connection
- Verify YouTube video is available
- Check yt-dlp is up to date

## Support

- 📧 Email: khayabeats@gmail.com
- 📱 Phone: +27 61 461 7733

---

Made with ❤️ by KHAYABEATS
