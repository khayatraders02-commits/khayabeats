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
  ITUNES_API: 'https://itunes.apple.com',
};

[CONFIG.CACHE_DIR, CONFIG.TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const metadataCache = new NodeCache({ stdTTL: 86400, checkperiod: 600 });
const pendingAudioRequests = new Map();

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

function mapFilePathToCacheEntry(filePath) {
  const ext = path.extname(filePath);
  return {
    filePath,
    ext,
    contentType: getContentType(ext),
  };
}

function findCachedFile(videoId) {
  const formats = ['.webm', '.m4a', '.opus', '.mp3', '.ogg'];
  for (const ext of formats) {
    const filePath = path.join(CONFIG.CACHE_DIR, `${videoId}${ext}`);
    if (fs.existsSync(filePath)) {
      return mapFilePathToCacheEntry(filePath);
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

async function requestEngineFetch(videoId, title, artist) {
  const response = await fetch(`${CONFIG.YT_ENGINE_URL}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, title, artist }),
    signal: AbortSignal.timeout(110000),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `yt-engine request failed (${response.status})`);
  }

  return data;
}

async function ensureCachedTrack(videoId, title, artist) {
  const alreadyCached = findCachedFile(videoId);
  if (alreadyCached) return alreadyCached;

  const existingRequest = pendingAudioRequests.get(videoId);
  if (existingRequest) {
    console.log(`[DEDUPE] Waiting for existing fetch ${videoId}`);
    return existingRequest;
  }

  const pendingRequest = (async () => {
    console.log(`[CACHE MISS] Queueing ${videoId}`);
    const data = await requestEngineFetch(videoId, title, artist);

    const cached = findCachedFile(videoId);
    if (cached) return cached;

    if (data?.filePath && fs.existsSync(data.filePath)) {
      return mapFilePathToCacheEntry(data.filePath);
    }

    throw new Error('Download completed but file not found');
  })().finally(() => {
    pendingAudioRequests.delete(videoId);
  });

  pendingAudioRequests.set(videoId, pendingRequest);
  return pendingRequest;
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
      pendingDownloads: pendingAudioRequests.size,
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

// ==================== SEARCH HELPERS ====================

const JUNK_PATTERNS = [
  /slowed/i,
  /sped\s*up/i,
  /remix/i,
  /cover/i,
  /\blive\b/i,
  /reaction/i,
  /instrumental/i,
  /karaoke/i,
  /\b8d\b/i,
  /fan\s*made/i,
  /nightcore/i,
  /remake/i,
  /reimagined/i,
  /tribute/i,
  /\btype\s*beat\b/i,
  /\bmashup\b/i,
  /\breverb\b/i,
  /\bletra\b/i,
  /\bsped\s*and\s*pitched\b/i,
];

const OFFICIAL_HINT_PATTERNS = [/official\s*(audio|video)?/i, /\bvevo\b/i, /-\s*topic\b/i];

const STOP_WORDS = new Set(['official', 'audio', 'video', 'lyrics', 'song', 'music', 'the', 'a', 'an', 'and', '&']);

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\(official[^)]*\)/gi, '')
    .replace(/\[(official|lyrics?|hd|4k|audio|video)[^\]]*\]/gi, '')
    .replace(/[–—-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantWords(query) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function parseDurationToSeconds(duration) {
  if (!duration || typeof duration !== 'string' || !duration.includes(':')) return null;
  const parts = duration.split(':').map(p => Number(p));
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
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
  if (OFFICIAL_HINT_PATTERNS.some(pattern => pattern.test(combined))) score += 16;

  const viewCount = Number(track.viewCount || 0);
  if (viewCount > 0) {
    score += Math.min(22, Math.log10(viewCount + 1) * 4);
  }

  const durationSeconds = parseDurationToSeconds(track.duration);
  if (durationSeconds && durationSeconds < 70) score -= 20;
  if (durationSeconds && durationSeconds > 120) score += 8;

  return score;
}

/**
 * Filter, deduplicate and rank tracks
 */
function rankTracks(query, tracks) {
  const words = significantWords(query);
  const normalizedQuery = normalizeTitle(query);

  const filtered = tracks.filter(track => {
    const text = `${track.title} ${track.artist}`;
    if (JUNK_PATTERNS.some(p => p.test(text))) return false;
    if (words.length === 0) return true;
    const lower = text.toLowerCase();
    const matchCount = words.filter(w => lower.includes(w)).length;
    return matchCount >= Math.min(2, words.length);
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

/**
 * Derive unique artists from track list
 */
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
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(a => ({
      id: toSlug(a.name),
      name: a.name,
      image: a.image,
    }));
}

/**
 * Fetch albums from iTunes
 */
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
  } catch {
    return [];
  }
}

/**
 * Fetch artist info from iTunes
 */
async function fetchITunesArtist(name) {
  try {
    const res = await fetch(`${CONFIG.ITUNES_API}/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] || null;
  } catch {
    return null;
  }
}

function formatDurationMs(ms) {
  if (!ms || Number.isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({
    name: 'KhayaBeats API Server',
    status: 'online',
    version: '2.0.0',
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

app.get('/health', async (req, res) => {
  let engine = { online: false };

  try {
    const response = await fetch(`${CONFIG.YT_ENGINE_URL}/health`, {
      signal: AbortSignal.timeout(1500),
    });

    if (response.ok) {
      const data = await response.json();
      engine = {
        online: true,
        server: data.server,
        queue: data?.stats?.currentQueue ?? 0,
      };
    }
  } catch {
    engine = { online: false };
  }

  res.json({
    status: 'ok',
    server: 'khayabeats-api',
    version: '2.0.0',
    uptime: process.uptime(),
    cache: getCacheStats(),
    engine,
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

/**
 * UPGRADED SEARCH: Returns grouped { artists, songs, albums }
 * GET /search?q=<query>&limit=60
 */
app.get('/search', async (req, res) => {
  const { q, limit = 60 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    // Check metadata cache
    const cacheKey = `search:${q}:${limit}`;
    const cached = metadataCache.get(cacheKey);
    if (cached) {
      console.log(`[SEARCH CACHE HIT] ${q}`);
      return res.json(cached);
    }

    // Fetch raw results from yt-engine
    let rawTracks = [];
    try {
      const response = await fetch(`${CONFIG.YT_ENGINE_URL}/search?q=${encodeURIComponent(q)}&limit=${limit}`);
      const data = await response.json();
      rawTracks = data.results || [];
    } catch (e) {
      console.error('[SEARCH] yt-engine search failed:', e.message);
    }

    if (rawTracks.length === 0) {
      return res.json({ artists: [], songs: [], albums: [] });
    }

    // Filter, deduplicate, rank
    const songs = rankTracks(q, rawTracks).slice(0, 30);
    const artists = deriveArtists(songs);

    // Fetch albums from iTunes in parallel
    const albums = await fetchITunesAlbums(q);

    const result = { artists, songs, albums };

    // Cache for 10 minutes
    metadataCache.set(cacheKey, result, 600);

    console.log(`[SEARCH] ${q} → ${artists.length} artists, ${songs.length} songs, ${albums.length} albums`);
    res.json(result);
  } catch (error) {
    console.error('[SEARCH ERROR]', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * ARTIST PROFILE: Returns full profile with top songs, albums, singles
 * GET /artists/:artistId?name=<artistName>
 */
app.get('/artists/:artistId', async (req, res) => {
  const { artistId } = req.params;
  const artistName = req.query.name || artistId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  try {
    // Check cache
    const cacheKey = `artist:${artistId}`;
    const cached = metadataCache.get(cacheKey);
    if (cached) {
      console.log(`[ARTIST CACHE HIT] ${artistName}`);
      return res.json(cached);
    }

    // Parallel: search songs, fetch iTunes artist info, fetch iTunes albums
    const [songsResponse, artistInfo, albumsData] = await Promise.all([
      // Songs search via yt-engine
      (async () => {
        try {
          const r = await fetch(`${CONFIG.YT_ENGINE_URL}/search?q=${encodeURIComponent(artistName + ' official songs')}&limit=40`);
          const d = await r.json();
          return d.results || [];
        } catch { return []; }
      })(),
      fetchITunesArtist(artistName),
      (async () => {
        try {
          const r = await fetch(`${CONFIG.ITUNES_API}/search?term=${encodeURIComponent(artistName)}&entity=album&limit=24`);
          if (!r.ok) return [];
          const d = await r.json();
          return (d.results || []).map(album => ({
            id: String(album.collectionId),
            title: album.collectionName,
            artist: album.artistName,
            coverImage: album.artworkUrl100?.replace('100x100bb', '600x600bb'),
            releaseDate: album.releaseDate,
          }));
        } catch { return []; }
      })(),
    ]);

    // Filter songs to only those by this artist
    const rankedSongs = rankTracks(artistName, songsResponse);
    const firstWord = artistName.toLowerCase().split(' ')[0];
    const topSongs = rankedSongs
      .filter(s => s.artist.toLowerCase().includes(firstWord))
      .slice(0, 20);

    const singles = albumsData.filter(a => /single/i.test(a.title)).slice(0, 8);
    const albums = albumsData.filter(a => !/single/i.test(a.title)).slice(0, 12);

    const profile = {
      id: artistId,
      name: artistInfo?.artistName || artistName,
      image: topSongs[0]?.thumbnailUrl || null,
      bannerImage: topSongs[0]?.thumbnailUrl || null,
      bio: artistInfo
        ? `${artistInfo.artistName} is a ${artistInfo.primaryGenreName || ''} artist.`
        : `${artistName} profile generated from live catalog data.`,
      genres: artistInfo?.primaryGenreName ? [artistInfo.primaryGenreName] : [],
      monthlyListeners: Math.floor((topSongs.length || 1) * 125000),
      topSongs,
      albums,
      singles,
    };

    // Cache for 1 hour
    metadataCache.set(cacheKey, profile, 3600);

    console.log(`[ARTIST] ${artistName} → ${topSongs.length} songs, ${albums.length} albums`);
    res.json(profile);
  } catch (error) {
    console.error('[ARTIST ERROR]', error.message);
    res.status(500).json({ error: 'Failed to load artist profile' });
  }
});

/**
 * ALBUM PROFILE: Returns album metadata + full tracklist
 * GET /albums/:albumId?title=<title>&artist=<artist>
 */
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

    const collection = (data.results || []).find((item) => item.wrapperType === 'collection');
    const tracks = (data.results || [])
      .filter((item) => item.wrapperType === 'track')
      .map((track) => ({
        id: String(track.trackId),
        title: track.trackName,
        artist: track.artistName,
        duration: formatDurationMs(track.trackTimeMillis),
        trackNumber: track.trackNumber,
      }));

    if (!collection && tracks.length === 0) {
      return res.status(404).json({ error: 'Album not found' });
    }

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

/**
 * Download for offline
 */
app.get('/offline/download/:videoId', async (req, res) => {
  const { videoId } = req.params;

  try {
    let cached = findCachedFile(videoId);

    if (!cached) {
      const response = await fetch(`${CONFIG.YT_ENGINE_URL}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });

      const data = await response.json();
      if (!data.success || !data.filePath) {
        return res.status(500).json({ error: 'Download failed' });
      }

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
║   🎵 KHAYABEATS API Server v2.0                        ║
║                                                        ║
║   Running on: http://localhost:${PORT}                   ║
║   Cache Dir:  ${CONFIG.CACHE_DIR}
║                                                        ║
║   Endpoints:                                           ║
║   • GET  /              - Server info                  ║
║   • GET  /health        - Health check                 ║
║   • GET  /stream/:id    - Stream audio                 ║
║   • POST /audio-url     - Get stream URL               ║
║   • GET  /search?q=     - Grouped search               ║
║   • GET  /artists/:id   - Artist profile               ║
║   • GET  /albums/:id    - Album profile + tracks       ║
║   • GET  /offline/download/:id - Download for offline  ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
