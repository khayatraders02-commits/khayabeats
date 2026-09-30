/**
 * Security helpers for running the KhayaBeats server publicly from a home PC.
 *
 * - SERVER_KEY: private key shared only with the cloud function (never the app).
 * - Signed stream links: the cloud function hands the app short-lived URLs
 *   (?exp=...&sig=...) so the key itself never reaches a browser/phone.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));

const SERVER_KEY = process.env.KB_SERVER_KEY || '';
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isValidVideoId(id) {
  return typeof id === 'string' && VIDEO_ID_RE.test(id);
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function sign(videoId, exp) {
  return crypto.createHmac('sha256', SERVER_KEY).update(`${videoId}:${exp}`).digest('hex');
}

function hasValidKey(req) {
  if (!SERVER_KEY) return false;
  const header = req.get('x-kb-key') || '';
  return header.length > 0 && safeEqual(header, SERVER_KEY);
}

function hasValidSignature(req, videoId) {
  if (!SERVER_KEY) return false;
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig || '');
  if (!exp || !sig || exp * 1000 < Date.now()) return false;
  return safeEqual(sig, sign(videoId, exp));
}

/** Require the private key header (cloud function / admin scripts only). */
function requireKey(req, res, next) {
  if (!SERVER_KEY) {
    return res.status(503).json({ success: false, error: 'Server key not configured. Run INSTALL.bat again.' });
  }
  if (!hasValidKey(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  next();
}

/** Allow either the key header or a valid signed link for :videoId routes. */
function requireKeyOrSignature(req, res, next) {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) return res.status(400).json({ success: false, error: 'Invalid video ID' });
  if (!SERVER_KEY) {
    return res.status(503).json({ success: false, error: 'Server key not configured. Run INSTALL.bat again.' });
  }
  if (hasValidKey(req) || hasValidSignature(req, videoId)) return next();
  return res.status(401).json({ success: false, error: 'Link expired or invalid' });
}

/** Tiny in-memory per-IP rate limiter (no extra dependency). */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.reset < now) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = (req.get('x-forwarded-for') || req.ip || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const entry = hits.get(ip) || { count: 0, reset: now + windowMs };
    if (entry.reset < now) { entry.count = 0; entry.reset = now + windowMs; }
    entry.count += 1;
    hits.set(ip, entry);
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
      return res.status(429).json({ success: false, error: 'Too many requests, slow down.' });
    }
    next();
  };
}

const DEFAULT_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
  /^capacitor:\/\/localhost$/i,
  /^ionic:\/\/localhost$/i,
];

const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // Audio elements, the cloud function and native apps often send no Origin.
    if (!origin) return cb(null, true);
    if (EXTRA_ORIGINS.includes(origin) || DEFAULT_ORIGIN_PATTERNS.some((re) => re.test(origin))) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
};

module.exports = {
  SERVER_KEY,
  isValidVideoId,
  requireKey,
  requireKeyOrSignature,
  rateLimit,
  corsOptions,
};
