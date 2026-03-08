import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

const YT_SERVER_URL = Deno.env.get("KHAYABEATS_SERVER_URL") || "";

// ── Source 1: Private yt-dlp server ──
async function wakeServer(): Promise<boolean> {
  if (!YT_SERVER_URL) return false;
  try {
    console.log(`[YT-Server] Waking server...`);
    const r = await fetch(`${YT_SERVER_URL}/health`, { signal: AbortSignal.timeout(55000) });
    const ok = r.ok;
    console.log(`[YT-Server] Wake ${ok ? "OK" : "FAIL " + r.status}`);
    return ok;
  } catch (e) { console.log(`[YT-Server] Wake failed: ${(e as Error).message}`); return false; }
}

async function tryYTServer(videoId: string, title?: string, artist?: string): Promise<{ url: string; mimeType: string } | null> {
  if (!YT_SERVER_URL) return null;
  try {
    console.log(`[YT-Server] Trying: ${YT_SERVER_URL}`);
    const r = await fetch(`${YT_SERVER_URL}/audio-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, title, artist }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) { console.log(`[YT-Server] HTTP ${r.status}`); return null; }
    const d = await r.json();
    if (d.success && d.audioUrl) { console.log(`✓ [YT-Server] OK`); return { url: d.audioUrl, mimeType: "audio/mpeg" }; }
    return null;
  } catch (e) { console.log(`[YT-Server] ${(e as Error).message}`); return null; }
}

// ── Source 2: Cobalt API (most reliable public extractor) ──
async function tryCobalt(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Public cobalt instances
  const instances = [
    "https://api.cobalt.tools",
    "https://cobalt-api.kwiatekmiki.com",
  ];

  for (const instance of instances) {
    try {
      console.log(`[Cobalt] Trying: ${instance}`);
      const r = await fetch(instance, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: "audio",
          audioFormat: "mp3",
          audioBitrate: "128",
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!r.ok) {
        const txt = await r.text();
        console.log(`[Cobalt] ${instance}: HTTP ${r.status} - ${txt.slice(0, 100)}`);
        continue;
      }

      const data = await r.json();
      // Cobalt returns { status: "tunnel"|"redirect"|"stream", url: "..." }
      if (data.url) {
        console.log(`✓ [Cobalt] Got URL (status: ${data.status})`);
        return { url: data.url, mimeType: "audio/mpeg" };
      }
      // Picker mode (shouldn't happen for audio-only)
      if (data.picker && data.picker.length > 0 && data.picker[0].url) {
        console.log(`✓ [Cobalt] Got picker URL`);
        return { url: data.picker[0].url, mimeType: "audio/mpeg" };
      }
      if (data.audio) {
        console.log(`✓ [Cobalt] Got audio URL`);
        return { url: data.audio, mimeType: "audio/mpeg" };
      }

      console.log(`[Cobalt] ${instance}: No URL in response: ${JSON.stringify(data).slice(0, 200)}`);
    } catch (e) {
      console.log(`[Cobalt] ${instance}: ${(e as Error).message}`);
    }
  }
  return null;
}

// ── Source 3: Piped (YouTube proxy) ──
async function tryPiped(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Only instance confirmed UP from piped-instances.kavin.rocks
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.private.coffee",
    "https://pipedapi.leptons.xyz",
    "https://piped.ezero.space",
  ];

  for (const instance of instances) {
    try {
      console.log(`[Piped] Trying: ${instance}`);
      const r = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "Accept": "application/json" },
      });
      if (!r.ok) { console.log(`[Piped] ${instance}: HTTP ${r.status}`); continue; }
      const data = await r.json();
      if (data.error) { console.log(`[Piped] ${instance}: ${data.error}`); continue; }
      const streams = (data.audioStreams || []).filter((s: any) => s.url);
      if (streams.length === 0) continue;
      streams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      console.log(`✓ [Piped] Success from ${instance}`);
      return { url: streams[0].url, mimeType: streams[0].mimeType || "audio/mp4" };
    } catch (e) {
      console.log(`[Piped] ${instance}: ${(e as Error).message}`);
    }
  }
  return null;
}

// ── Source 4: Invidious ──
async function tryInvidious(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // From docs.invidious.io - currently healthy instances
  const instances = [
    "https://yewtu.be",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
  ];

  for (const instance of instances) {
    try {
      console.log(`[Invidious] Trying: ${instance}`);
      const r = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "Accept": "application/json" },
      });
      if (!r.ok) { console.log(`[Invidious] ${instance}: HTTP ${r.status}`); continue; }
      const data = await r.json();
      const audioFormats = (data.adaptiveFormats || []).filter((f: any) =>
        f.type?.includes('audio') && f.url
      );
      if (audioFormats.length === 0) continue;
      audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      console.log(`✓ [Invidious] Success from ${instance}`);
      return { url: audioFormats[0].url, mimeType: audioFormats[0].type?.split(';')[0] || "audio/mp4" };
    } catch (e) {
      console.log(`[Invidious] ${instance}: ${(e as Error).message}`);
    }
  }
  return null;
}

// (Audius source removed)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ── PROXY MODE ──
    const proxyUrl = url.searchParams.get("proxy");
    if (proxyUrl) {
      const decodedUrl = decodeURIComponent(proxyUrl);
      const rangeHeader = req.headers.get("range");
      const headers: HeadersInit = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://www.youtube.com/",
      };
      if (rangeHeader) headers["Range"] = rangeHeader;

      const audioResponse = await fetch(decodedUrl, { headers, signal: AbortSignal.timeout(30000) });
      if (!audioResponse.ok && audioResponse.status !== 206) {
        const body = await audioResponse.text();
        return new Response(
          JSON.stringify({ error: "Audio source unavailable", success: false }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const responseHeaders: HeadersInit = {
        ...corsHeaders,
        "Content-Type": audioResponse.headers.get("content-type") || "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=7200",
      };
      const cl = audioResponse.headers.get("content-length");
      const cr = audioResponse.headers.get("content-range");
      if (cl) responseHeaders["Content-Length"] = cl;
      if (cr) responseHeaders["Content-Range"] = cr;

      return new Response(audioResponse.body, { status: audioResponse.status, headers: responseHeaders });
    }

    // ── MAIN REQUEST ──
    const body = await req.json();
    const { videoId, title, artist } = body;

    if (!videoId && !title) {
      return new Response(
        JSON.stringify({ error: "Video ID or title required", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`\n===== Audio Request =====`);
    console.log(`Title: ${title} | Artist: ${artist} | VideoID: ${videoId}`);

    let result: { url: string; mimeType: string; trackInfo?: any } | null = null;
    let serverOnline = false;

    // 1. Private yt-dlp server (wake first to handle Render cold starts)
    if (videoId && YT_SERVER_URL) {
      console.log(`[1/5] Your yt-dlp server...`);
      const awake = await wakeServer();
      if (awake) {
        result = await tryYTServer(videoId, title, artist);
        if (result) serverOnline = true;
      }
    }

    // 2. Cobalt (most reliable public extractor)
    if (!result && videoId) {
      console.log(`[2/5] Cobalt...`);
      result = await tryCobalt(videoId);
    }

    // 3. Piped
    if (!result && videoId) {
      console.log(`[3/5] Piped...`);
      result = await tryPiped(videoId);
    }

    // 4. Invidious
    if (!result && videoId) {
      console.log(`[4/5] Invidious...`);
      result = await tryInvidious(videoId);
    }

    // 5. (Audius removed)

    if (!result) {
      console.error("❌ All sources failed");
      return new Response(
        JSON.stringify({
          error: "Start your KhayaBeats server on your PC to play this track. All public audio sources are currently unavailable for mainstream music.",
          serverOnline: false,
          success: false,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const isLocalUrl = result.url.includes("localhost") || result.url.includes("127.0.0.1");
    const proxyEndpoint = isLocalUrl
      ? result.url
      : `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(result.url)}`;

    console.log(`✅ Audio ready!`);

    return new Response(
      JSON.stringify({
        audioUrl: proxyEndpoint,
        directUrl: result.url,
        mimeType: result.mimeType,
        trackInfo: result.trackInfo,
        serverOnline,
        success: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to get audio",
        serverOnline: false,
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
