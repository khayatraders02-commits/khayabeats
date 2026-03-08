/**
 * KHAYABEATS Server v3.0
 * 
 * Single-process server: API + yt-dlp engine combined.
 * No separate engine process needed — just `npm start`.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');
const NodeCache = require('node-cache');
const Queue = require('better-queue');

const app = express();
const PORT = process.env.PORT || 3001;

const COOKIES_PATH = path.join(__dirname, 'cookies.txt');
const OAUTH_CACHE_DIR = path.join(__dirname, 'storage', 'yt-dlp-cache');

const CONFIG = {
  CACHE_DIR: path.join(__dirname, 'storage', 'music-cache'),
  TEMP_DIR: path.join(__dirname, 'storage', 'temp'),
  OAUTH_CACHE_DIR,
  MAX_CACHE_SIZE_GB: 50,
  CACHE_CLEANUP_INTERVAL: 60 * 60 * 1000,
  ITUNES_API: 'https://itunes.apple.com',
  MAX_CONCURRENT_DOWNLOADS: 6,
  DOWNLOAD_TIMEOUT: 120000,
  MAX_DOWNLOAD_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: 1500,
  YT_DLP_PATH: getYtDlpPath(),
  COOKIES_FILE: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : null,
  USE_OAUTH: process.env.YT_OAUTH_REFRESH_TOKEN ? true : false,
  OAUTH_REFRESH_TOKEN: process.env.YT_OAUTH_REFRESH_TOKEN || null,
};

[CONFIG.CACHE_DIR, CONFIG.TEMP_DIR, CONFIG.OAUTH_CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper: get auth args for yt-dlp (OAuth preferred, cookies fallback)
function getAuthArgs() {
  const args = [];
  if (CONFIG.USE_OAUTH) {
    args.push('--username', 'oauth', '--password', CONFIG.OAUTH_REFRESH_TOKEN || '');
    args.push('--cache-dir', CONFIG.OAUTH_CACHE_DIR);
  } else if (CONFIG.COOKIES_FILE) {
    args.push('--cookies', CONFIG.COOKIES_FILE);
  }
  return args;
}

const metadataCache = new NodeCache({ stdTTL: 86400, checkperiod: 600 });

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== YT-DLP ENGINE (embedded) ====================

function getYtDlpPath() {
  const isWindows = os.platform() === 'win32';
  const localPath = path.join(__dirname, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(localPath)) return localPath;
  const enginePath = path.join(__dirname, 'yt-engine', isWindows ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(enginePath)) return enginePath;
  return 'yt-dlp';
}

const dlStats = { total: 0, success: 0, failed: 0, active: 0, queued: 0, cacheHits: 0 };
const inflightDownloads = new Map();

const downloadQueue = new Queue(async (task, cb) => {
  try {
    const result = await downloadAudioWithRetry(task.videoId);
    cb(null, result);
  } catch (error) {
    cb(error);
  }
}, { concurrent: CONFIG.MAX_CONCURRENT_DOWNLOADS, maxRetries: 0 });

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

function getLatestFileByPrefix(videoId) {
  try {
    const prefix = `${videoId}.`;
    const files = fs.readdirSync(CONFIG.CACHE_DIR)
      .filter(name => name.startsWith(prefix) && !name.endsWith('.part'));
    if (files.length === 0) return null;
    const sorted = files
      .map(name => {
        const filePath = path.join(CONFIG.CACHE_DIR, name);
        const stat = fs.statSync(filePath);
        return { filePath, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return { filePath: sorted[0].filePath, ext: path.extname(sorted[0].filePath) };
  } catch { return null; }
}

function runYtDlpDownload(videoId) {
  return new Promise((resolve, reject) => {
    const existing = findCachedFile(videoId);
    if (existing) return resolve({ filePath: existing.filePath, cached: true });

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
      ...getAuthArgs(),
    ];

    console.log(`[DOWNLOAD] Starting: ${videoId} (auth: ${CONFIG.USE_OAUTH ? 'OAuth' : CONFIG.COOKIES_FILE ? 'cookies' : 'none'})`);
    const proc = spawn(CONFIG.YT_DLP_PATH, args);
    let stderr = '';
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGKILL');
      reject(new Error('Download timeout'));
    }, CONFIG.DOWNLOAD_TIMEOUT);

    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (code !== 0) {
        const hint = stderr.split('\n').map(s => s.trim()).filter(Boolean).slice(-1)[0] || '';
        return reject(new Error(hint || `yt-dlp exited with code ${code}`));
      }
      const cached = findCachedFile(videoId) || getLatestFileByPrefix(videoId);
      if (!cached) return reject(new Error('Download completed but file not found'));
      console.log(`[CACHED] ${path.basename(cached.filePath)}`);
      resolve({ filePath: cached.filePath, cached: false });
    });
    proc.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });
  });
}

async function downloadAudioWithRetry(videoId) {
  let lastError = null;
  for (let attempt = 1; attempt <= CONFIG.MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) console.log(`[RETRY] ${videoId} attempt ${attempt}/${CONFIG.MAX_DOWNLOAD_ATTEMPTS}`);
      return await runYtDlpDownload(videoId);
    } catch (error) {
      lastError = error;
      if (attempt < CONFIG.MAX_DOWNLOAD_ATTEMPTS) {
        await new Promise(r => setTimeout(r, CONFIG.RETRY_BACKOFF_MS * attempt));
      }
    }
  }
  throw lastError || new Error('Download failed');
}

function enqueueDownload(videoId) {
  // Check cache first
  const cached = findCachedFile(videoId);
  if (cached) {
    dlStats.cacheHits++;
    return Promise.resolve(cached);
  }

  // Deduplicate in-flight requests
  let promise = inflightDownloads.get(videoId);
  if (promise) {
    console.log(`[DEDUPE] Joining in-flight download for ${videoId}`);
    return promise;
  }

  dlStats.total++;
  dlStats.queued++;

  promise = new Promise((resolve, reject) => {
    downloadQueue.push({ videoId }, (err, result) => {
      dlStats.queued = Math.max(0, dlStats.queued - 1);
      if (err) {
        dlStats.failed++;
        reject(err);
      } else {
        dlStats.success++;
        resolve(result);
      }
    });
  }).finally(() => {
    inflightDownloads.delete(videoId);
  });

  inflightDownloads.set(videoId, promise);
  console.log(`[QUEUE] ${videoId} queued (${dlStats.queued} in queue)`);
  return promise;
}

function searchYouTube(query, limit = 20) {
  return new Promise((resolve, reject) => {
    const args = [
      `ytsearch${limit}:${query}`,
      '--dump-single-json',
      '--no-warnings',
      '--quiet',
      ...getAuthArgs(),
    ];
    const proc = spawn(CONFIG.YT_DLP_PATH, args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code !== 0) {
        const hint = stderr.split('\n').map(s => s.trim()).filter(Boolean).slice(-1)[0] || '';
        return reject(new Error(hint || `Search failed with code ${code}`));
      }
      try {
        const json = JSON.parse(stdout || '{}');
        const entries = Array.isArray(json.entries) ? json.entries : [];
        const results = entries
          .filter(e => e && e.id)
          .map(e => ({
            id: e.id,
            videoId: e.id,
            title: e.title || 'Unknown Title',
            artist: e.channel || e.uploader || 'Unknown',
            channelId: e.channel_id || null,
            thumbnailUrl: `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg`,
            duration: formatDuration(e.duration),
            viewCount: e.view_count || 0,
          }));
        resolve(results);
      } catch (error) {
        reject(new Error(`Failed to parse results: ${error.message}`));
      }
    });
    proc.on('error', err => reject(new Error(`Search error: ${err.message}`)));
  });
}

// ==================== HELPERS ====================

function getContentType(ext) {
  return { '.mp3': 'audio/mpeg', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.opus': 'audio/opus', '.ogg': 'audio/ogg' }[ext] || 'audio/mpeg';
}

function streamFile(filePath, contentType, res) {
  const stat = fs.statSync(filePath);
  const range = res.req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': (end - start) + 1,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  }
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDurationMs(ms) {
  if (!ms || Number.isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
}

function getCacheStats() {
  try {
    const files = fs.readdirSync(CONFIG.CACHE_DIR);
    let totalSize = 0;
    files.forEach(file => {
      totalSize += fs.statSync(path.join(CONFIG.CACHE_DIR, file)).size;
    });
    return {
      totalFiles: files.length,
      totalSizeMB: Math.round(totalSize / 1024 / 1024),
      totalSizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2),
      maxSizeGB: CONFIG.MAX_CACHE_SIZE_GB,
      pendingDownloads: inflightDownloads.size,
      queuedJobs: dlStats.queued,
      activeDownloads: dlStats.active,
    };
  } catch {
    return { error: 'Could not read cache' };
  }
}

function cleanupCache(maxAgeDays) {
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deleted = 0;
  try {
    fs.readdirSync(CONFIG.CACHE_DIR).forEach(file => {
      const filePath = path.join(CONFIG.CACHE_DIR, file);
      if (now - fs.statSync(filePath).mtimeMs > maxAge) { fs.unlinkSync(filePath); deleted++; }
    });
  } catch (e) { console.error('Cache cleanup error:', e); }
  return deleted;
}

// ==================== SEARCH / RANKING ====================

const JUNK_PATTERNS = [
  /slowed/i, /sped\s*up/i, /remix/i, /cover/i, /\blive\b/i, /reaction/i,
  /instrumental/i, /karaoke/i, /\b8d\b/i, /fan\s*made/i, /nightcore/i,
  /remake/i, /reimagined/i, /tribute/i, /\btype\s*beat\b/i, /\bmashup\b/i,
  /\breverb\b/i, /\bletra\b/i, /\bsped\s*and\s*pitched\b/i,
  /\btop\s*\d+\b/i, /\bbest\s*(of|hits)\b/i, /\bmix\b/i, /\bmegamix\b/i,
  /\bplaylist\b/i, /\bcompilation\b/i, /\bnonstop\b/i, /\bnon[\s-]*stop\b/i,
  /\bmedley\b/i, /\bcollection\b/i, /\bgreatest\s*hits\b/i,
  /\ball\s*songs\b/i, /\bfull\s*album\b/i, /\b1\s*hour\b/i, /\b2\s*hour/i,
  /\b3\s*hour/i, /\bhour\s*long\b/i, /\bhours?\b/i,
  /\bbest\s*songs?\s*\d{4}/i, /\bhits\s*\d{4}/i,
];
const OFFICIAL_HINT_PATTERNS = [/official\s*(audio|video)?/i, /\bvevo\b/i, /-\s*topic\b/i];
const STOP_WORDS = new Set(['official', 'audio', 'video', 'lyrics', 'song', 'music', 'the', 'a', 'an', 'and', '&']);

function normalizeTitle(title) {
  return title.toLowerCase()
    .replace(/\(official[^)]*\)/gi, '')
    .replace(/\[(official|lyrics?|hd|4k|audio|video)[^\]]*\]/gi, '')
    .replace(/[–—-]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function significantWords(query) {
  return query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function toSlug(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseDurationToSeconds(duration) {
  if (!duration || typeof duration !== 'string' || !duration.includes(':')) return null;
  const parts = duration.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function scoreTrack(queryWords, normalizedQuery, track) {
  const title = track.title || '';
  const artist = track.artist || '';
  const combined = `${title} ${artist}`.toLowerCase();
  const normalizedTrackTitle = normalizeTitle(title);
  let score = 0;
  for (const word of queryWords) {
    if (artist.toLowerCase().includes(word)) score += 10;
    if (title.toLowerCase().includes(word)) score += 7;
  }
  if (normalizedTrackTitle.includes(normalizedQuery)) score += 30;
  if (OFFICIAL_HINT_PATTERNS.some(p => p.test(combined))) score += 16;
  const viewCount = Number(track.viewCount || 0);
  if (viewCount > 0) score += Math.min(22, Math.log10(viewCount + 1) * 4);
  const dur = parseDurationToSeconds(track.duration);
  if (dur && dur < 70) score -= 20;
  if (dur && dur > 120) score += 8;
  return score;
}

function rankTracks(query, tracks) {
  const words = significantWords(query);
  const normalizedQuery = normalizeTitle(query);
  const filtered = tracks.filter(track => {
    const text = `${track.title} ${track.artist}`;
    if (JUNK_PATTERNS.some(p => p.test(text))) return false;
    // Filter out tracks longer than 10 minutes (600s) — likely compilations/mixes
    const dur = parseDurationToSeconds(track.duration);
    if (dur && dur > 600) return false;
    // Filter out very short clips too
    if (dur && dur < 30) return false;
    if (words.length === 0) return true;
    const lower = text.toLowerCase();
    return words.filter(w => lower.includes(w)).length >= Math.min(2, words.length);
  });
  const sorted = filtered
    .map(track => ({ track, score: scoreTrack(words, normalizedQuery, track) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.track);
  const dedupMap = new Map();
  for (const track of sorted) {
    const key = `${normalizeTitle(track.title)}::${track.artist.toLowerCase()}`;
    if (!dedupMap.has(key)) dedupMap.set(key, track);
  }
  return Array.from(dedupMap.values());
}

function deriveArtists(tracks) {
  const counts = new Map();
  tracks.forEach((track, idx) => {
    const name = track.artist || 'Unknown Artist';
    const key = name.toLowerCase();
    const current = counts.get(key) || { name, score: 0, image: track.thumbnailUrl };
    current.score += Math.max(1, 20 - idx);
    if (!current.image && track.thumbnailUrl) current.image = track.thumbnailUrl;
    counts.set(key, current);
  });
  return Array.from(counts.values())
    .sort((a, b) => b.score - a.score).slice(0, 5)
    .map(a => ({ id: toSlug(a.name), name: a.name, image: a.image }));
}

async function fetchITunesAlbums(query) {
  try {
    const res = await fetch(`${CONFIG.ITUNES_API}/search?term=${encodeURIComponent(query)}&entity=album&limit=8`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(album => ({
      id: String(album.collectionId),
      title: album.collectionName,
      artist: album.artistName,
      coverImage: album.artworkUrl100?.replace('100x100bb', '600x600bb'),
      releaseDate: album.releaseDate,
    }));
  } catch { return []; }
}

async function fetchITunesArtist(name) {
  try {
    const res = await fetch(`${CONFIG.ITUNES_API}/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`);
    if (!res.ok) return null;
    return (await res.json()).results?.[0] || null;
  } catch { return null; }
}

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({
    name: 'KhayaBeats Server',
    status: 'online',
    version: '3.0.0',
    endpoints: [
      'GET  /health',
      'GET  /stream/:videoId',
      'POST /audio-url',
      'GET  /search?q=',
      'GET  /artists/:id',
      'GET  /albums/:id',
      'GET  /offline/download/:videoId',
      'GET  /cache/stats',
    ],
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'khayabeats',
    version: '3.0.0',
    uptime: process.uptime(),
    cache: getCacheStats(),
    engine: {
      online: true,
      embedded: true,
      queue: dlStats.queued,
      activeDownloads: inflightDownloads.size,
      stats: dlStats,
    },
  });
});

// Stream a cached/downloaded track
app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });

  try {
    const result = await enqueueDownload(videoId);
    const file = findCachedFile(videoId) || result;
    console.log(`[STREAM] ${videoId}`);
    return streamFile(file.filePath, file.contentType || getContentType(file.ext), res);
  } catch (error) {
    console.error(`[ERROR] Stream failed for ${videoId}:`, error.message);
    res.status(500).json({ error: 'Stream failed', message: error.message });
  }
});

// Get audio URL (triggers download if needed, returns stream URL)
app.post('/audio-url', async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ success: false, error: 'Video ID required' });

  try {
    const wasCached = Boolean(findCachedFile(videoId));
    if (wasCached) console.log(`[CACHE HIT] ${videoId}`);

    await enqueueDownload(videoId);

    return res.json({
      success: true,
      audioUrl: `${req.protocol}://${req.get('host')}/stream/${videoId}`,
      cached: wasCached,
    });
  } catch (error) {
    console.error('[ERROR] Audio URL failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Grouped search
app.get('/search', async (req, res) => {
  const { q, limit = 60 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    const cacheKey = `search:${q}:${limit}`;
    const cached = metadataCache.get(cacheKey);
    if (cached) {
      console.log(`[SEARCH CACHE HIT] ${q}`);
      return res.json(cached);
    }

    const rawTracks = await searchYouTube(q, parseInt(limit, 10));
    if (rawTracks.length === 0) return res.json({ artists: [], songs: [], albums: [] });

    const songs = rankTracks(q, rawTracks).slice(0, 30);
    const artists = deriveArtists(songs);
    const albums = await fetchITunesAlbums(q);
    const result = { artists, songs, albums };
    metadataCache.set(cacheKey, result, 600);
    console.log(`[SEARCH] ${q} → ${artists.length} artists, ${songs.length} songs, ${albums.length} albums`);
    res.json(result);
  } catch (error) {
    console.error('[SEARCH ERROR]', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Artist profile
app.get('/artists/:artistId', async (req, res) => {
  const { artistId } = req.params;
  const artistName = req.query.name || artistId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  try {
    const cacheKey = `artist:${artistId}`;
    const cached = metadataCache.get(cacheKey);
    if (cached) return res.json(cached);

    const [rawSongs, artistInfo, albumsData] = await Promise.all([
      searchYouTube(`${artistName} official songs`, 40).catch(() => []),
      fetchITunesArtist(artistName),
      (async () => {
        try {
          const r = await fetch(`${CONFIG.ITUNES_API}/search?term=${encodeURIComponent(artistName)}&entity=album&limit=24`);
          if (!r.ok) return [];
          return (await r.json()).results?.map(a => ({
            id: String(a.collectionId), title: a.collectionName, artist: a.artistName,
            coverImage: a.artworkUrl100?.replace('100x100bb', '600x600bb'), releaseDate: a.releaseDate,
          })) || [];
        } catch { return []; }
      })(),
    ]);

    const rankedSongs = rankTracks(artistName, rawSongs);
    const firstWord = artistName.toLowerCase().split(' ')[0];
    const topSongs = rankedSongs.filter(s => s.artist.toLowerCase().includes(firstWord)).slice(0, 20);
    const singles = albumsData.filter(a => /single/i.test(a.title)).slice(0, 8);
    const albums = albumsData.filter(a => !/single/i.test(a.title)).slice(0, 12);

    const profile = {
      id: artistId,
      name: artistInfo?.artistName || artistName,
      image: topSongs[0]?.thumbnailUrl || null,
      bannerImage: topSongs[0]?.thumbnailUrl || null,
      bio: artistInfo ? `${artistInfo.artistName} is a ${artistInfo.primaryGenreName || ''} artist.` : `${artistName} profile.`,
      genres: artistInfo?.primaryGenreName ? [artistInfo.primaryGenreName] : [],
      monthlyListeners: Math.floor((topSongs.length || 1) * 125000),
      topSongs, albums, singles,
    };

    metadataCache.set(cacheKey, profile, 3600);
    console.log(`[ARTIST] ${artistName} → ${topSongs.length} songs, ${albums.length} albums`);
    res.json(profile);
  } catch (error) {
    console.error('[ARTIST ERROR]', error.message);
    res.status(500).json({ error: 'Failed to load artist profile' });
  }
});

// Album profile
app.get('/albums/:albumId', async (req, res) => {
  const { albumId } = req.params;
  const titleHint = req.query.title;
  const artistHint = req.query.artist;

  try {
    let lookup = await fetch(`${CONFIG.ITUNES_API}/lookup?id=${encodeURIComponent(albumId)}&entity=song`);
    let data = lookup.ok ? await lookup.json() : { results: [] };

    if ((!data.results || data.results.length === 0) && titleHint) {
      const query = `${titleHint} ${artistHint || ''}`.trim();
      const search = await fetch(`${CONFIG.ITUNES_API}/search?term=${encodeURIComponent(query)}&entity=album&limit=1`);
      const searchData = search.ok ? await search.json() : { results: [] };
      const match = searchData.results?.[0];
      if (match?.collectionId) {
        lookup = await fetch(`${CONFIG.ITUNES_API}/lookup?id=${encodeURIComponent(match.collectionId)}&entity=song`);
        data = lookup.ok ? await lookup.json() : { results: [] };
      }
    }

    const collection = (data.results || []).find(item => item.wrapperType === 'collection');
    const tracks = (data.results || [])
      .filter(item => item.wrapperType === 'track')
      .map(track => ({
        id: String(track.trackId),
        title: track.trackName,
        artist: track.artistName,
        duration: formatDurationMs(track.trackTimeMillis),
        trackNumber: track.trackNumber,
      }));

    if (!collection && tracks.length === 0) return res.status(404).json({ error: 'Album not found' });

    return res.json({
      id: String(collection?.collectionId || albumId),
      title: collection?.collectionName || titleHint || 'Album',
      artist: collection?.artistName || artistHint || 'Unknown Artist',
      coverImage: collection?.artworkUrl100?.replace('100x100bb', '600x600bb') || null,
      releaseDate: collection?.releaseDate || null,
      tracks,
    });
  } catch (error) {
    console.error('[ALBUM ERROR]', error.message);
    return res.status(500).json({ error: 'Failed to load album' });
  }
});

// Download for offline — streams the file as an attachment
app.get('/offline/download/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const result = await enqueueDownload(videoId);
    const file = findCachedFile(videoId) || result;
    const ext = file.ext || path.extname(file.filePath);
    res.setHeader('Content-Type', file.contentType || getContentType(ext));
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}${ext}"`);
    fs.createReadStream(file.filePath).pipe(res);
  } catch (error) {
    console.error(`[ERROR] Offline download failed for ${videoId}:`, error.message);
    res.status(500).json({ error: 'Download failed', message: error.message });
  }
});

app.get('/cache/stats', (req, res) => res.json(getCacheStats()));

// Upload cookies.txt via POST (for Render deployment)
app.post('/upload-cookies', express.text({ type: '*/*', limit: '1mb' }), (req, res) => {
  try {
    fs.writeFileSync(COOKIES_PATH, req.body);
    CONFIG.COOKIES_FILE = COOKIES_PATH;
    console.log('[COOKIES] cookies.txt uploaded and activated');
    res.json({ success: true, message: 'Cookies uploaded successfully' });
  } catch (error) {
    console.error('[COOKIES ERROR]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check cookies status
app.get('/cookies-status', (req, res) => {
  const exists = fs.existsSync(COOKIES_PATH);
  res.json({ 
    hasCookies: exists, 
    path: exists ? COOKIES_PATH : null,
    size: exists ? fs.statSync(COOKIES_PATH).size : 0,
  });
});

// OAuth setup — initiates the OAuth device flow
// Call this endpoint, then follow the URL printed in server logs
app.post('/oauth-setup', async (req, res) => {
  try {
    console.log('[OAUTH] Starting OAuth device flow...');
    
    const proc = spawn(CONFIG.YT_DLP_PATH, [
      '--username', 'oauth',
      '--password', '',
      '--cache-dir', CONFIG.OAUTH_CACHE_DIR,
      '-s', // simulate only, don't download
      'https://www.youtube.com/watch?v=dQw4w9WcXgQ', // any video
    ]);
    
    let output = '';
    let authUrl = null;
    let authCode = null;
    
    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { 
      const text = d.toString();
      output += text;
      // Look for the auth URL and code
      const codeMatch = text.match(/enter code\s+([A-Z0-9-]+)/i);
      if (codeMatch) authCode = codeMatch[1];
      if (text.includes('google.com/device')) authUrl = 'https://www.google.com/device';
    });
    
    // Wait a few seconds for the auth prompt
    await new Promise(r => setTimeout(r, 10000));
    
    if (authCode) {
      console.log(`[OAUTH] Auth code: ${authCode}`);
      console.log(`[OAUTH] Go to: https://www.google.com/device and enter the code`);
      
      res.json({
        success: true,
        message: 'OAuth flow started! Go to the URL below and enter the code.',
        url: 'https://www.google.com/device',
        code: authCode,
        instructions: [
          '1. Open https://www.google.com/device in your browser',
          `2. Enter code: ${authCode}`,
          '3. Sign in with a YouTube/Google account (use a throwaway account, NOT your main one)',
          '4. After authorizing, the server will automatically cache the refresh token',
          '5. Songs should start playing within 30 seconds',
        ],
      });
      
      // Let the process continue to complete the auth flow
      proc.on('close', (code) => {
        if (code === 0) {
          CONFIG.USE_OAUTH = true;
          console.log('[OAUTH] ✅ OAuth setup completed! Refresh token cached.');
        } else {
          console.log(`[OAUTH] Process exited with code ${code}. Check if you completed the auth in browser.`);
        }
      });
    } else {
      proc.kill();
      // Maybe OAuth is already set up
      res.json({
        success: false,
        message: 'Could not start OAuth flow. OAuth may already be configured, or yt-dlp version may not support it.',
        output: output.slice(-500),
      });
    }
  } catch (error) {
    console.error('[OAUTH ERROR]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check auth status
app.get('/auth-status', (req, res) => {
  const hasCookies = fs.existsSync(COOKIES_PATH);
  const hasOAuthCache = fs.existsSync(path.join(CONFIG.OAUTH_CACHE_DIR, 'youtube-nsig'));
  
  // Check if OAuth token files exist in cache
  let hasOAuthToken = false;
  try {
    const cacheFiles = fs.readdirSync(CONFIG.OAUTH_CACHE_DIR);
    hasOAuthToken = cacheFiles.some(f => f.includes('oauth') || f.includes('token'));
  } catch {}
  
  res.json({
    method: CONFIG.USE_OAUTH ? 'oauth' : hasCookies ? 'cookies' : 'none',
    oauthConfigured: CONFIG.USE_OAUTH || hasOAuthToken,
    cookiesConfigured: hasCookies,
    oauthRefreshTokenSet: Boolean(CONFIG.OAUTH_REFRESH_TOKEN),
    status: (CONFIG.USE_OAUTH || hasOAuthToken) ? 'authenticated' : hasCookies ? 'cookies-mode' : 'unauthenticated',
  });
});

app.post('/cache/cleanup', (req, res) => {
  const { maxAgeDays = 30 } = req.body;
  const deleted = cleanupCache(maxAgeDays);
  res.json({ deleted, message: `Cleaned ${deleted} old files` });
});

// Periodic cache cleanup
setInterval(() => {
  const deleted = cleanupCache(30);
  if (deleted > 0) console.log(`[CLEANUP] Removed ${deleted} old files`);
}, CONFIG.CACHE_CLEANUP_INTERVAL);

// ==================== START ====================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🎵 KHAYABEATS Server v3.0                        ║
║                                                    ║
║   Running on: http://localhost:${PORT}               ║
║   Cache Dir:  ${CONFIG.CACHE_DIR}
║   yt-dlp:     ${CONFIG.YT_DLP_PATH}
║                                                    ║
║   ✅ Single process — no separate engine needed    ║
║   ✅ Just run: npm start                           ║
║   🔐 Auth: ${CONFIG.USE_OAUTH ? 'OAuth ✅' : CONFIG.COOKIES_FILE ? 'Cookies 🍪' : 'NONE ⚠️'}
║                                                    ║
╚════════════════════════════════════════════════════╝
  `);

  exec(`${CONFIG.YT_DLP_PATH} --version`, (error, stdout) => {
    if (error) {
      console.error(`
⚠️  yt-dlp not found! Install it:
    pip install yt-dlp
    OR download from https://github.com/yt-dlp/yt-dlp/releases
      `);
    } else {
      console.log(`✅ yt-dlp version: ${stdout.trim()}`);
    }

    if (!CONFIG.USE_OAUTH && !CONFIG.COOKIES_FILE) {
      console.warn(`
⚠️  No authentication configured!
    YouTube will block requests from datacenter IPs.
    
    RECOMMENDED — OAuth (one-time setup, auto-renews):
    1. POST to /oauth-setup to start the OAuth flow
    2. Follow the URL and enter the code shown
    3. Done! Token auto-refreshes forever.
    
    OR set YT_OAUTH_REFRESH_TOKEN env var on Render.
    
    ALTERNATIVE — Cookies (manual, expires):
    1. Export cookies from your browser
    2. POST to /upload-cookies
      `);
    }
  });
});

module.exports = app;
