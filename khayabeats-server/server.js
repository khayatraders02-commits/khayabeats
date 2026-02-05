/**
 * KHAYABEATS Main API Server
 * 
 * This server handles:
 * - User streaming requests
 * - Cache management
 * - Communication with yt-engine
 * - Offline download preparation
 * 
 * Run with: npm start
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration
const CONFIG = {
  CACHE_DIR: path.join(__dirname, 'storage', 'music-cache'),
  TEMP_DIR: path.join(__dirname, 'storage', 'temp'),
  YT_ENGINE_URL: process.env.YT_ENGINE_URL || 'http://localhost:3002',
  MAX_CACHE_SIZE_GB: 50, // Maximum cache size in GB
  CACHE_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
};

// Ensure directories exist
[CONFIG.CACHE_DIR, CONFIG.TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// In-memory metadata cache
const metadataCache = new NodeCache({ stdTTL: 86400, checkperiod: 600 });

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== ROUTES ====================

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'khayabeats-api',
    version: '1.0.0',
    uptime: process.uptime(),
    cache: getCacheStats(),
  });
});

/**
 * Stream audio
 * GET /stream?id=<videoId>
 * 
 * Flow:
 * 1. Check if song is in cache
 * 2. If cached, stream from cache
 * 3. If not cached, request from yt-engine and stream
 */
app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  if (!videoId) {
    return res.status(400).json({ error: 'Video ID required' });
  }
  
  try {
    const cachedFile = path.join(CONFIG.CACHE_DIR, `${videoId}.mp3`);
    
    // Check if cached
    if (fs.existsSync(cachedFile)) {
      console.log(`[CACHE HIT] Streaming ${videoId} from cache`);
      return streamFile(cachedFile, res);
    }
    
    console.log(`[CACHE MISS] Fetching ${videoId} from yt-engine`);
    
    // Request from yt-engine
    const response = await fetch(`${CONFIG.YT_ENGINE_URL}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch from yt-engine');
    }
    
    const data = await response.json();
    
    if (!data.success || !data.filePath) {
      throw new Error(data.error || 'Download failed');
    }
    
    // Move to cache and stream
    const tempFile = data.filePath;
    fs.copyFileSync(tempFile, cachedFile);
    
    // Clean temp file after copying
    try { fs.unlinkSync(tempFile); } catch(e) {}
    
    return streamFile(cachedFile, res);
    
  } catch (error) {
    console.error(`[ERROR] Stream failed for ${videoId}:`, error.message);
    res.status(500).json({ error: 'Stream failed', message: error.message });
  }
});

/**
 * Get audio URL (for web clients that can't stream directly)
 * POST /audio-url
 * Body: { videoId: string, title?: string, artist?: string }
 */
app.post('/audio-url', async (req, res) => {
  const { videoId, title, artist } = req.body;
  
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'Video ID required' });
  }
  
  try {
    const cachedFile = path.join(CONFIG.CACHE_DIR, `${videoId}.mp3`);
    
    // Check if cached
    if (fs.existsSync(cachedFile)) {
      console.log(`[CACHE HIT] ${videoId}`);
      return res.json({
        success: true,
        audioUrl: `http://localhost:${PORT}/stream/${videoId}`,
        cached: true,
      });
    }
    
    console.log(`[CACHE MISS] Queueing ${videoId}`);
    
    // Request from yt-engine
    const response = await fetch(`${CONFIG.YT_ENGINE_URL}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, title, artist }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Download failed');
    }
    
    // Move to cache
    if (data.filePath && fs.existsSync(data.filePath)) {
      fs.copyFileSync(data.filePath, cachedFile);
      try { fs.unlinkSync(data.filePath); } catch(e) {}
    }
    
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

/**
 * Search YouTube
 * GET /search?q=<query>
 */
app.get('/search', async (req, res) => {
  const { q, limit = 20 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }
  
  try {
    const response = await fetch(`${CONFIG.YT_ENGINE_URL}/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Download for offline (returns encrypted blob)
 * GET /offline/download/:videoId
 */
app.get('/offline/download/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  try {
    const cachedFile = path.join(CONFIG.CACHE_DIR, `${videoId}.mp3`);
    
    // Ensure file is cached
    if (!fs.existsSync(cachedFile)) {
      // Fetch first
      const response = await fetch(`${CONFIG.YT_ENGINE_URL}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      
      const data = await response.json();
      if (data.success && data.filePath) {
        fs.copyFileSync(data.filePath, cachedFile);
        try { fs.unlinkSync(data.filePath); } catch(e) {}
      }
    }
    
    if (!fs.existsSync(cachedFile)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // For offline, we send the raw audio (client encrypts if needed)
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}.mp3"`);
    fs.createReadStream(cachedFile).pipe(res);
    
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

/**
 * Cache statistics
 * GET /cache/stats
 */
app.get('/cache/stats', (req, res) => {
  res.json(getCacheStats());
});

/**
 * Clear old cache entries
 * POST /cache/cleanup
 */
app.post('/cache/cleanup', (req, res) => {
  const { maxAgeDays = 30 } = req.body;
  const deleted = cleanupCache(maxAgeDays);
  res.json({ deleted, message: `Cleaned ${deleted} old files` });
});

// ==================== HELPERS ====================

function streamFile(filePath, res) {
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
      'Content-Type': 'audio/mpeg',
    });
    
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'audio/mpeg',
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

// Periodic cache cleanup
setInterval(() => {
  console.log('[CLEANUP] Running periodic cache cleanup...');
  const deleted = cleanupCache(30);
  console.log(`[CLEANUP] Removed ${deleted} old files`);
}, CONFIG.CACHE_CLEANUP_INTERVAL);

// ==================== START SERVER ====================

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
║   • GET  /health          - Health check               ║
║   • GET  /stream/:id      - Stream audio               ║
║   • POST /audio-url       - Get stream URL             ║
║   • GET  /search?q=       - Search YouTube             ║
║   • GET  /offline/:id     - Download for offline       ║
║   • GET  /cache/stats     - Cache statistics           ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
