/**
 * KHAYABEATS YT-DLP Engine
 *
 * Dedicated microservice for YouTube audio extraction.
 * Uses yt-dlp for reliable audio downloading with queue management.
 *
 * Run with: node yt-engine/engine.js
 */

const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Queue = require('better-queue');

const app = express();
const PORT = process.env.YT_ENGINE_PORT || 3002;

const CONFIG = {
  CACHE_DIR: path.join(__dirname, '..', 'storage', 'music-cache'),
  MAX_CONCURRENT_DOWNLOADS: Number(process.env.MAX_CONCURRENT_DOWNLOADS || 10),
  DOWNLOAD_TIMEOUT: Number(process.env.DOWNLOAD_TIMEOUT_MS || 180000),
  MAX_DOWNLOAD_ATTEMPTS: Number(process.env.MAX_DOWNLOAD_ATTEMPTS || 3),
  RETRY_BACKOFF_MS: Number(process.env.RETRY_BACKOFF_MS || 1200),
  YT_DLP_PATH: getYtDlpPath(),
};

if (!fs.existsSync(CONFIG.CACHE_DIR)) {
  fs.mkdirSync(CONFIG.CACHE_DIR, { recursive: true });
}

app.use(express.json());

const stats = {
  totalRequests: 0,
  successfulDownloads: 0,
  failedDownloads: 0,
  cacheHits: 0,
  activeDownloads: 0,
  queuedJobs: 0,
};

const inflightDownloads = new Map();

const downloadQueue = new Queue(async (task, cb) => {
  try {
    const result = await downloadAudioWithRetry(task.videoId, task.title, task.artist);
    cb(null, result);
  } catch (error) {
    cb(error);
  }
}, {
  concurrent: CONFIG.MAX_CONCURRENT_DOWNLOADS,
  maxRetries: 0,
});

function getCachedFile(videoId) {
  const formats = ['.webm', '.m4a', '.opus', '.mp3', '.ogg'];

  for (const ext of formats) {
    const filePath = path.join(CONFIG.CACHE_DIR, `${videoId}${ext}`);
    if (fs.existsSync(filePath)) {
      return { filePath, ext };
    }
  }

  return null;
}

function getLatestFileByPrefix(videoId) {
  try {
    const prefix = `${videoId}.`;
    const files = fs.readdirSync(CONFIG.CACHE_DIR)
      .filter((name) => name.startsWith(prefix) && !name.endsWith('.part'));

    if (files.length === 0) return null;

    const sorted = files
      .map((name) => {
        const filePath = path.join(CONFIG.CACHE_DIR, name);
        const stat = fs.statSync(filePath);
        return { name, filePath, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    const latest = sorted[0];
    return { filePath: latest.filePath, ext: path.extname(latest.filePath) };
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimStderr(stderr) {
  if (!stderr) return '';

  const line = stderr
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(-1)[0];

  return line || '';
}

function enqueueDownloadTask(task) {
  stats.queuedJobs += 1;

  return new Promise((resolve, reject) => {
    downloadQueue.push(task, (err, result) => {
      stats.queuedJobs = Math.max(0, stats.queuedJobs - 1);
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function downloadAudioWithRetry(videoId, title, artist) {
  let lastError = null;

  for (let attempt = 1; attempt <= CONFIG.MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      if (attempt > 1) {
        console.log(`[RETRY] ${videoId} attempt ${attempt}/${CONFIG.MAX_DOWNLOAD_ATTEMPTS}`);
      }

      return await runYtDlpDownload(videoId, title, artist);
    } catch (error) {
      lastError = error;

      if (attempt === CONFIG.MAX_DOWNLOAD_ATTEMPTS) {
        break;
      }

      const backoff = CONFIG.RETRY_BACKOFF_MS * attempt;
      await sleep(backoff);
    }
  }

  throw lastError || new Error('Download failed');
}

function runYtDlpDownload(videoId) {
  return new Promise((resolve, reject) => {
    const existing = getCachedFile(videoId);
    if (existing) {
      return resolve({ filePath: existing.filePath, cached: true });
    }

    const outputTemplate = path.join(CONFIG.CACHE_DIR, `${videoId}.%(ext)s`);

    const args = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=opus]/bestaudio',
      '--output', outputTemplate,
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--ignore-errors',
      '--socket-timeout', '20',
      '--retries', '3',
      '--fragment-retries', '3',
      '--extractor-retries', '3',
      '--concurrent-fragments', '1',
      '--force-ipv4',
      '--no-part',
    ];

    console.log(`[DOWNLOAD] Starting: ${videoId}`);

    const process = spawn(CONFIG.YT_DLP_PATH, args);

    let stderr = '';
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      process.kill('SIGKILL');
      reject(new Error('Download timeout'));
    }, CONFIG.DOWNLOAD_TIMEOUT);

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      if (code !== 0) {
        const stderrHint = trimStderr(stderr);
        return reject(new Error(stderrHint || `yt-dlp exited with code ${code}`));
      }

      const cached = getCachedFile(videoId) || getLatestFileByPrefix(videoId);
      if (!cached) {
        return reject(new Error('Download completed but file not found'));
      }

      console.log(`[CACHED] ${path.basename(cached.filePath)}`);
      resolve({ filePath: cached.filePath, cached: false });
    });

    process.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });
  });
}

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({
    name: 'KhayaBeats YT Engine',
    status: 'online',
    version: '1.1.0',
    endpoints: ['GET /', 'GET /health', 'POST /fetch', 'GET /search?q=', 'GET /queue'],
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'khayabeats-yt-engine',
    version: '1.1.0',
    stats,
    ytdlp: CONFIG.YT_DLP_PATH,
  });
});

app.post('/fetch', async (req, res) => {
  const { videoId, title, artist } = req.body;

  if (!videoId) {
    return res.status(400).json({ success: false, error: 'Video ID required' });
  }

  stats.totalRequests += 1;

  const cached = getCachedFile(videoId);
  if (cached) {
    stats.cacheHits += 1;
    return res.json({
      success: true,
      filePath: cached.filePath,
      cached: true,
    });
  }

  let requestPromise = inflightDownloads.get(videoId);

  if (!requestPromise) {
    console.log(`[QUEUE] Adding ${videoId} to download queue`);

    requestPromise = (async () => {
      stats.activeDownloads = inflightDownloads.size + 1;

      try {
        const result = await enqueueDownloadTask({ videoId, title, artist });
        stats.successfulDownloads += 1;
        return result;
      } catch (error) {
        stats.failedDownloads += 1;
        throw error;
      }
    })().finally(() => {
      inflightDownloads.delete(videoId);
      stats.activeDownloads = inflightDownloads.size;
    });

    inflightDownloads.set(videoId, requestPromise);
  } else {
    console.log(`[DEDUPE] Joining in-flight download for ${videoId}`);
  }

  try {
    const result = await requestPromise;
    return res.json({
      success: true,
      filePath: result.filePath,
      cached: Boolean(result.cached),
    });
  } catch (error) {
    console.error(`[ERROR] Download failed for ${videoId}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/search', async (req, res) => {
  const { q, limit = 20 } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    const results = await searchYouTube(q, parseInt(limit, 10));
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

app.get('/queue', (req, res) => {
  res.json({
    currentQueue: stats.queuedJobs,
    inFlight: inflightDownloads.size,
    stats,
  });
});

// ==================== SEARCH ====================

async function searchYouTube(query, limit = 20) {
  return new Promise((resolve, reject) => {
    const args = [
      `ytsearch${limit}:${query}`,
      '--dump-single-json',
      '--no-warnings',
      '--quiet',
    ];

    const process = spawn(CONFIG.YT_DLP_PATH, args);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(trimStderr(stderr) || `Search failed with code ${code}`));
      }

      try {
        const json = JSON.parse(stdout || '{}');
        const entries = Array.isArray(json.entries) ? json.entries : [];

        const results = entries
          .filter((entry) => entry && entry.id)
          .map((entry) => ({
            id: entry.id,
            videoId: entry.id,
            title: entry.title || 'Unknown Title',
            artist: entry.channel || entry.uploader || 'Unknown',
            channelId: entry.channel_id || null,
            thumbnailUrl: `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`,
            duration: formatDuration(entry.duration),
            viewCount: entry.view_count || 0,
          }));

        resolve(results);
      } catch (error) {
        reject(new Error(`Failed to parse results: ${error.message}`));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Search error: ${err.message}`));
    });
  });
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🎵 KHAYABEATS YT-DLP Engine                          ║
║                                                        ║
║   Running on: http://localhost:${PORT}                   ║
║   Cache Dir:  ${CONFIG.CACHE_DIR}
║   yt-dlp:     ${CONFIG.YT_DLP_PATH}
║   Max Concurrent: ${CONFIG.MAX_CONCURRENT_DOWNLOADS}                                ║
║                                                        ║
║   ⚠️  NO FFMPEG REQUIRED - streams native audio       ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);

  exec(`${CONFIG.YT_DLP_PATH} --version`, (error, stdout) => {
    if (error) {
      console.error(`
⚠️  WARNING: yt-dlp not found!

    Please install yt-dlp:

    Windows:
      pip install yt-dlp
      OR
      Download from https://github.com/yt-dlp/yt-dlp/releases

    macOS/Linux:
      pip install yt-dlp
      OR
      brew install yt-dlp
      `);
    } else {
      console.log(`✅ yt-dlp version: ${stdout.trim()}`);
    }
  });
});

module.exports = app;
