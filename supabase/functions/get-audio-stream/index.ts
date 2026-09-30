import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const SIGNED_LINK_TTL_SECONDS = 6 * 60 * 60;

type ProviderAttempt = { provider: string; success: boolean; status?: number; error?: string };
type HomeHealth = {
  online: boolean;
  status?: number;
  keyConfigured?: boolean;
  youtubeAuth?: string;
  selfTestOk?: boolean | null;
  selfTestCheckedAt?: string | null;
  cache?: unknown;
  error?: string;
};

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://api.piped.private.coffee",
];
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://yewtu.be",
];

// Only these hosts may be proxied, so this function is never an open proxy.
const PROXY_HOST_SUFFIXES = [
  ".googlevideo.com",
  ...PIPED_INSTANCES.map((u) => new URL(u).hostname),
  ...INVIDIOUS_INSTANCES.map((u) => new URL(u).hostname),
];

function getHomeConfig() {
  const url = (Deno.env.get("KHAYABEATS_SERVER_URL") || "").trim().replace(/\/$/, "");
  const key = (Deno.env.get("KHAYABEATS_SERVER_KEY") || "").trim();
  const usable = url.startsWith("https://") && !url.includes("onrender.com");
  return { url: usable ? url : "", key };
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function hmacHex(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signedHomeUrl(baseUrl: string, key: string, route: "stream" | "offline/download", videoId: string) {
  const exp = Math.floor(Date.now() / 1000) + SIGNED_LINK_TTL_SECONDS;
  const sig = await hmacHex(key, `${videoId}:${exp}`);
  return `${baseUrl}/${route}/${videoId}?exp=${exp}&sig=${sig}`;
}

async function checkHome(baseUrl: string): Promise<HomeHealth> {
  if (!baseUrl) return { online: false, error: "not-configured" };
  try {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!res.ok || !data || data.server !== "khayabeats") {
      return { online: false, status: res.status, error: `Health check returned ${res.status}` };
    }
    return {
      online: true,
      status: res.status,
      keyConfigured: Boolean(data.keyConfigured),
      youtubeAuth: data.youtubeAuth,
      selfTestOk: data.selfTest?.ok ?? null,
      selfTestCheckedAt: data.selfTest?.checkedAt ?? null,
      cache: data.cache ?? null,
    };
  } catch (e) {
    return { online: false, error: errMsg(e) };
  }
}

async function tryPiped(videoId: string, attempts: ProviderAttempt[]) {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, { signal: AbortSignal.timeout(4500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const streams = (data.audioStreams || []).filter((s: any) => s.url);
      if (!streams.length) throw new Error("no audio streams");
      streams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      attempts.push({ provider: base, success: true });
      return { url: streams[0].url as string, mimeType: streams[0].mimeType || "audio/mp4", provider: base };
    } catch (e) {
      attempts.push({ provider: base, success: false, error: errMsg(e) });
    }
  }
  return null;
}

async function tryInvidious(videoId: string, attempts: ProviderAttempt[]) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(4500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const formats = (data.adaptiveFormats || []).filter((f: any) => f.type?.includes("audio") && f.url);
      if (!formats.length) throw new Error("no audio formats");
      formats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      attempts.push({ provider: base, success: true });
      return { url: formats[0].url as string, mimeType: formats[0].type?.split(";")[0] || "audio/mp4", provider: base };
    } catch (e) {
      attempts.push({ provider: base, success: false, error: errMsg(e) });
    }
  }
  return null;
}

async function proxyAudio(req: Request, target: string) {
  let parsed: URL;
  try { parsed = new URL(target); } catch { return json({ success: false, error: "Invalid proxy URL" }, 400); }
  const allowed = parsed.protocol === "https:" &&
    PROXY_HOST_SUFFIXES.some((s) => parsed.hostname === s || parsed.hostname.endsWith(s.startsWith(".") ? s : `.${s}`));
  if (!allowed) return json({ success: false, error: "Host not allowed" }, 403);

  const headers: HeadersInit = { "User-Agent": "Mozilla/5.0", Accept: "*/*" };
  const range = req.headers.get("range");
  if (range) headers["Range"] = range;

  const upstream = await fetch(parsed.toString(), { headers, signal: AbortSignal.timeout(30000) });
  const contentType = upstream.headers.get("content-type") || "";
  const audioLike = contentType.startsWith("audio/") || contentType.includes("octet-stream") || contentType.startsWith("video/");
  if ((!upstream.ok && upstream.status !== 206) || !audioLike) {
    const snippet = (await upstream.text()).slice(0, 300);
    return json({ success: false, error: "Audio source returned a non-audio response", status: upstream.status, contentType, snippet }, 502);
  }

  const out: HeadersInit = { ...corsHeaders, "Content-Type": contentType, "Accept-Ranges": "bytes" };
  const len = upstream.headers.get("content-length");
  const cr = upstream.headers.get("content-range");
  if (len) out["Content-Length"] = len;
  if (cr) out["Content-Range"] = cr;
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const requestUrl = new URL(req.url);
    const proxyTarget = requestUrl.searchParams.get("proxy");
    if (proxyTarget) return await proxyAudio(req, proxyTarget);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const home = getHomeConfig();

    // Status check used by the app's Settings screen and banner.
    if (body?.action === "status") {
      const health = await checkHome(home.url);
      return json({
        success: true,
        serverUrlConfigured: Boolean(home.url),
        cloudKeyConfigured: Boolean(home.key),
        ...health,
      });
    }

    const videoId = typeof body?.videoId === "string" ? body.videoId.trim() : "";
    if (!VIDEO_ID_RE.test(videoId)) return json({ success: false, error: "Valid video ID required" }, 400);

    const attempts: ProviderAttempt[] = [];

    // 1) Home PC server (primary). Signed links keep the private key off devices.
    const health = await checkHome(home.url);
    if (health.online && home.key && health.keyConfigured) {
      const [audioUrl, downloadUrl] = await Promise.all([
        signedHomeUrl(home.url, home.key, "stream", videoId),
        signedHomeUrl(home.url, home.key, "offline/download", videoId),
      ]);
      attempts.push({ provider: "home-pc", success: true, status: health.status });
      return json({
        success: true,
        audioUrl,
        downloadUrl,
        mimeType: "audio/webm",
        source: "home-pc",
        serverOnline: true,
        selfTestOk: health.selfTestOk,
        providerDiagnostics: attempts,
      });
    }
    attempts.push({ provider: "home-pc", success: false, status: health.status, error: health.error || "key mismatch or missing" });

    // 2) Public mirrors as a last resort (often down).
    const mirror = (await tryPiped(videoId, attempts)) || (await tryInvidious(videoId, attempts));
    if (mirror) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const proxied = `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(mirror.url)}`;
      return json({
        success: true,
        audioUrl: proxied,
        downloadUrl: proxied,
        mimeType: mirror.mimeType,
        source: mirror.provider,
        serverOnline: health.online,
        providerDiagnostics: attempts,
      });
    }

    let error = "The KhayaBeats music server is offline. Make sure the home PC is on and START.bat is running.";
    if (!home.url) error = "The music server address has not been set yet. Finish the home PC setup and save its address.";
    else if (!home.key) error = "The music server key has not been saved in the app yet.";
    else if (health.online && !health.keyConfigured) error = "The home PC is online but has no server key. Run INSTALL.bat again.";

    console.log(JSON.stringify({ videoId, attempts }));
    return json({ success: false, error, serverOnline: health.online, providerDiagnostics: attempts }, 503);
  } catch (e) {
    return json({ success: false, error: errMsg(e), serverOnline: false }, 500);
  }
});
