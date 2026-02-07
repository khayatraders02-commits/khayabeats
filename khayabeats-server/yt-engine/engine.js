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

// Configuration
const CONFIG = {
  TEMP_DIR: path.join(__dirname, 'temp'),
  CACHE_DIR: path.join(__dirname, '..', 'storage', 'music-cache'),
  MAX_CONCURRENT_DOWNLOADS: 10,
  DOWNLOAD_TIMEOUT: 120000, // 2 minutes
  YT_DLP_PATH: getYtDlpPath(),
};

// Ensure directories exist
[CONFIG.TEMP_DIR, CONFIG.CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use(express.json());

// Download statistics
const stats = {
  totalDownloads: 0,
  successfulDownloads: 0,
  failedDownloads: 0,
  currentQueue: 0,
};

// Download queue with concurrency limit
const downloadQueue = new Queue(async (task, cb) => {
  stats.currentQueue--;
  
  try {
    const result = await downloadAudio(task.videoId, task.title, task.artist);
    stats.successfulDownloads++;
    cb(null, result);
  } catch (error) {
    stats.failedDownloads++;
    cb(error);
  }
}, {
  concurrent: CONFIG.MAX_CONCURRENT_DOWNLOADS,
  maxRetries: 2,
  retryDelay: 2000,
});

// ==================== ROUTES ====================

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'khayabeats-yt-engine',
    version: '1.0.0',
    stats,
    ytdlp: CONFIG.YT_DLP_PATH,
  });
});

/**
 * Fetch/Download audio
 * POST /fetch
 * Body: { videoId: string, title?: string, artist?: string }
 */
app.post('/fetch', async (req, res) => {
  const { videoId, title, artist } = req.body;
  
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'Video ID required' });
  }
  
  stats.totalDownloads++;
  stats.currentQueue++;
  
  console.log(`[QUEUE] Adding ${videoId} to download queue (${stats.currentQueue} in queue)`);
  
  // Check if already downloaded (any format)
  const formats = ['.webm', '.m4a', '.opus', '.mp3'];
  for (const ext of formats) {
    const existingFile = path.join(CONFIG.CACHE_DIR, `${videoId}${ext}`);
    if (fs.existsSync(existingFile)) {
      stats.currentQueue--;
      console.log(`[CACHE] ${videoId} already exists`);
      return res.json({
        success: true,
        filePath: existingFile,
        cached: true,
      });
    }
  }
  
  // Add to queue
  downloadQueue.push({ videoId, title, artist }, (err, result) => {
    if (err) {
      console.error(`[ERROR] Download failed for ${videoId}:`, err.message);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
    
    console.log(`[SUCCESS] Downloaded ${videoId}`);
    res.json({
      success: true,
      filePath: result.filePath,
      cached: false,
    });
  });
});

/**
 * Search YouTube
 * GET /search?q=<query>&limit=20
 */
app.get('/search', async (req, res) => {
  const { q, limit = 20 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }
  
  try {
    const results = await searchYouTube(q, parseInt(limit));
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

/**
 * Queue status
 */
app.get('/queue', (req, res) => {
  res.json({
    currentQueue: stats.currentQueue,
    stats,
  });
});

// ==================== CORE FUNCTIONS ====================

/**
 * Get yt-dlp executable path
 */
function getYtDlpPath() {
  const isWindows = os.platform() === 'win32';
  const localPath = path.join(__dirname, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
  
  // Check for local yt-dlp
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  
  // Use system yt-dlp
  return 'yt-dlp';
}

/**
 * Download audio from YouTube - NO FFMPEG REQUIRED
 * Downloads best audio in native format (webm/m4a/opus)
 */
async function downloadAudio(videoId, title, artist) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(CONFIG.TEMP_DIR, `${videoId}.%(ext)s`);
    
    // yt-dlp arguments - NO conversion, keeps original format
    const args = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
      '--output', tempFile,
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      // Avoid rate limiting
      '--sleep-interval', '1',
      '--max-sleep-interval', '3',
      // Retry on failure
      '--retries', '3',
      '--fragment-retries', '3',
    ];
    
    console.log(`[DOWNLOAD] Starting: ${videoId}`);
    
    const process = spawn(CONFIG.YT_DLP_PATH, args, {
      timeout: CONFIG.DOWNLOAD_TIMEOUT,
    });
    
    let stderr = '';
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        // Find the downloaded file (check multiple extensions)
        const formats = ['.webm', '.m4a', '.opus', '.mp3'];
        for (const ext of formats) {
          const downloadedFile = path.join(CONFIG.TEMP_DIR, `${videoId}${ext}`);
          if (fs.existsSync(downloadedFile)) {
            // Move to cache directory
            const cachedFile = path.join(CONFIG.CACHE_DIR, `${videoId}${ext}`);
            fs.copyFileSync(downloadedFile, cachedFile);
            fs.unlinkSync(downloadedFile);
            console.log(`[CACHED] ${videoId}${ext}`);
            return resolve({ filePath: cachedFile });
          }
        }
        reject(new Error('Download completed but file not found'));
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });
    
    // Timeout
    setTimeout(() => {
      process.kill();
      reject(new Error('Download timeout'));
    }, CONFIG.DOWNLOAD_TIMEOUT);
  });
}

/**
 * Search YouTube using yt-dlp
 */
async function searchYouTube(query, limit = 20) {
  return new Promise((resolve, reject) => {
    const args = [
      `ytsearch${limit}:${query}`,
      '--flat-playlist',
      '--dump-json',
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
        return reject(new Error(`Search failed: ${stderr}`));
      }
      
      try {
        // Parse each line as JSON (one result per line)
        const results = stdout
          .trim()
          .split('\n')
          .filter(line => line)
          .map(line => {
            const data = JSON.parse(line);
            return {
              id: data.id,
              videoId: data.id,
              title: data.title,
              artist: data.channel || data.uploader || 'Unknown',
              thumbnailUrl: `https://i.ytimg.com/vi/${data.id}/mqdefault.jpg`,
              duration: formatDuration(data.duration),
            };
          });
        
        resolve(results);
      } catch (e) {
        reject(new Error(`Failed to parse results: ${e.message}`));
      }
    });
    
    process.on('error', (err) => {
      reject(new Error(`Search error: ${err.message}`));
    });
  });
}

/**
 * Format duration from seconds to mm:ss
 */
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Cleanup old temp files periodically
setInterval(() => {
  const maxAge = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  
  try {
    const files = fs.readdirSync(CONFIG.TEMP_DIR);
    files.forEach(file => {
      const filePath = path.join(CONFIG.TEMP_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (e) {
    console.error('Temp cleanup error:', e);
  }
}, 5 * 60 * 1000); // Every 5 minutes

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
  
  // Check if yt-dlp is available
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
