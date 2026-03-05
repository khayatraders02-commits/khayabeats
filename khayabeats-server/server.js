/**
 * KHAYABEATS Main API Server
 * 
 * Run with: npm start
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 3001;

const CONFIG = {
  CACHE_DIR: path.join(__dirname, 'storage', 'music-cache'),
  TEMP_DIR: path.join(__dirname, 'storage', 'temp'),
  YT_ENGINE_URL: process.env.YT_ENGINE_URL || 'http://localhost:3002',
  MAX_CACHE_SIZE_GB: 50,
  CACHE_CLEANUP_INTERVAL: 60 * 60 * 1000,
};

[CONFIG.CACHE_DIR, CONFIG.TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const metadataCache = new NodeCache({ stdTTL: 86400, checkperiod: 600 });

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== HELPERS ====================

function getContentType(ext) {
  const types = {
    '.mp3': 'audio/mpeg',
    '.webm': 'audio/webm',
    '.m4a': 'audio/mp4',
    '.opus': 'audio/opus',
    '.ogg': 'audio/ogg',
  };
  return types[ext] || 'audio/mpeg';
}

function findCachedFile(videoId) {
  const formats = ['.webm', '.m4a', '.opus', '.mp3', '.ogg'];
  for (const ext of formats) {
    const filePath = path.join(CONFIG.CACHE_DIR, `${videoId}${ext}`);
    if (fs.existsSync(filePath)) {
      return { filePath, ext, contentType: getContentType(ext) };
    }
  }
  return null;
}

function streamFile(filePath, contentType, res) {
  const stat = fs.statSync(filePath);
  const range = res.req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

function getCacheStats() {
  try {
    const files = fs.readdirSync(CONFIG.CACHE_DIR);
    let totalSize = 0;
    files.forEach(file => {
      const stat = fs.statSync(path.join(CONFIG.CACHE_DIR, file));
      totalSize += stat.size;
    });
    return {
      totalFiles: files.length,
      totalSizeMB: Math.round(totalSize / 1024 / 1024),
      totalSizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2),
      maxSizeGB: CONFIG.MAX_CACHE_SIZE_GB,
    };
  } catch (e) {
    return { error: 'Could not read cache' };
  }
}

function cleanupCache(maxAgeDays) {
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deleted = 0;
  try {
    const files = fs.readdirSync(CONFIG.CACHE_DIR);
    files.forEach(file => {
      const filePath = path.join(CONFIG.CACHE_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    });
  } catch (e) {
    console.error('Cache cleanup error:', e);
  }
  return deleted;
}

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({
    name: 'KhayaBeats API Server',
    status: 'online',
    version: '1.0.0',
    endpoints: [
      'GET  /health',
      'GET  /stream/:videoId',
      'POST /audio-url',
      'GET  /search?q=',
      'GET  /offline/download/:videoId',
      'GET  /cache/stats',
    ],
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'khayabeats-api',
    version: '1.0.0',
    uptime: process.uptime(),
    cache: getCacheStats(),
  });
});

app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });

  try {
    const cached = findCachedFile(videoId);
    if (cached) {
      console.log(`[CACHE HIT] Streaming ${videoId}`);
      return streamFile(cached.filePath, cached.contentType, res);
    }

    console.log(`[CACHE MISS] Fetching ${videoId} from yt-engine`);
    const response = await fetch(`${CONFIG.YT_ENGINE_URL}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });

    if (!response.ok) throw new Error('Failed to fetch from yt-engine');
    const data = await response.json();
    if (!data.success || !data.filePath) throw new Error(data.error || 'Download failed');

    const ext = path.extname(data.filePath);
    return streamFile(data.filePath, getContentType(ext), res);
  } catch (error) {
    console.error(`[ERROR] Stream failed for ${videoId}:`, error.message);
    res.status(500).json({ error: 'Stream failed', message: error.message });
  }
});

app.post('/audio-url', async (req, res) => {
  const { videoId, title, artist } = req.body;
  if (!videoId) return res.status(400).json({ success: false, error: 'Video ID required' });

  try {
    const cached = findCachedFile(videoId);
    if (cached) {
      console.log(`[CACHE HIT] ${videoId}`);
      return res.json({
        success: true,
        audioUrl: `http://localhost:${PORT}/stream/${videoId}`,
        cached: true,
      });
    }

    console.log(`[CACHE MISS] Queueing ${videoId}`);
    const response = await fetch(`${CONFIG.YT_ENGINE_URL}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, title, artist }),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Download failed');

    return res.json({
      success: true,
      audioUrl: `http://localhost:${PORT}/stream/${videoId}`,
      cached: false,
    });
  } catch (error) {
    console.error(`[ERROR] Audio URL failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/search', async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    const response = await fetch(`${CONFIG.YT_ENGINE_URL}/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Download for offline - handles ALL audio formats (webm, m4a, opus, mp3)
 */
app.get('/offline/download/:videoId', async (req, res) => {
  const { videoId } = req.params;

  try {
    // Check cache for ANY format
    let cached = findCachedFile(videoId);

    if (!cached) {
      // Fetch from yt-engine first
      const response = await fetch(`${CONFIG.YT_ENGINE_URL}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });

      const data = await response.json();
      if (!data.success || !data.filePath) {
        return res.status(500).json({ error: 'Download failed' });
      }

      // Re-check cache after download
      cached = findCachedFile(videoId);
    }

    if (!cached) {
      return res.status(404).json({ error: 'File not found after download' });
    }

    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}${cached.ext}"`);
    fs.createReadStream(cached.filePath).pipe(res);
  } catch (error) {
    console.error(`[ERROR] Offline download failed for ${videoId}:`, error.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.get('/cache/stats', (req, res) => {
  res.json(getCacheStats());
});

app.post('/cache/cleanup', (req, res) => {
  const { maxAgeDays = 30 } = req.body;
  const deleted = cleanupCache(maxAgeDays);
  res.json({ deleted, message: `Cleaned ${deleted} old files` });
});

// Periodic cache cleanup
setInterval(() => {
  console.log('[CLEANUP] Running periodic cache cleanup...');
  const deleted = cleanupCache(30);
  console.log(`[CLEANUP] Removed ${deleted} old files`);
}, CONFIG.CACHE_CLEANUP_INTERVAL);

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🎵 KHAYABEATS API Server                             ║
║                                                        ║
║   Running on: http://localhost:${PORT}                   ║
║   Cache Dir:  ${CONFIG.CACHE_DIR}
║                                                        ║
║   Endpoints:                                           ║
║   • GET  /              - Server info                  ║
║   • GET  /health        - Health check                 ║
║   • GET  /stream/:id    - Stream audio                 ║
║   • POST /audio-url     - Get stream URL               ║
║   • GET  /search?q=     - Search YouTube               ║
║   • GET  /offline/download/:id - Download for offline  ║
║   • GET  /cache/stats   - Cache statistics             ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
