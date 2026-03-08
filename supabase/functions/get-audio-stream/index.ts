import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Innertube } from "npm:youtubei.js@latest";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

// ── Source 1: youtubei.js (handles signature decryption) ──
async function tryYouTubeJS(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  try {
    console.log(`[YouTubeJS] Creating client...`);
    const yt = await Innertube.create({ retrieve_player: true });
    
    console.log(`[YouTubeJS] Getting info for ${videoId}...`);
    const info = await yt.getBasicInfo(videoId);
    
    if (!info.streaming_data) {
      console.log(`[YouTubeJS] No streaming data`);
      return null;
    }

    // Get audio-only adaptive formats
    const audioFormats = (info.streaming_data.adaptive_formats || [])
      .filter((f: any) => f.mime_type?.startsWith("audio/") && f.decipher)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

    if (audioFormats.length === 0) {
      // Try getting URL directly
      const allAudio = (info.streaming_data.adaptive_formats || [])
        .filter((f: any) => f.mime_type?.startsWith("audio/"));
      
      if (allAudio.length === 0) {
        console.log(`[YouTubeJS] No audio formats found`);
        return null;
      }

      // Try to get the decipher URL
      const best = allAudio.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      const url = best.decipher?.(yt.session.player) || best.url;
      
      if (!url) {
        console.log(`[YouTubeJS] Could not decipher URL`);
        return null;
      }
      
      const mime = best.mime_type?.split(";")[0] || "audio/mp4";
      console.log(`✓ [YouTubeJS] Got audio (${mime}, ${best.bitrate}bps)`);
      return { url, mimeType: mime };
    }

    const best = audioFormats[0];
    const url = best.decipher?.(yt.session.player) || best.url;
    if (!url) {
      console.log(`[YouTubeJS] Could not get URL from best format`);
      return null;
    }
    
    const mime = best.mime_type?.split(";")[0] || "audio/mp4";
    console.log(`✓ [YouTubeJS] Got audio (${mime}, ${best.bitrate}bps)`);
    return { url, mimeType: mime };
  } catch (e) {
    console.log(`[YouTubeJS] Error: ${(e as Error).message}`);
    return null;
  }
}

// ── Source 2: Piped ──
async function tryPiped(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.private.coffee",
    "https://pipedapi.darkness.services",
    "https://watchapi.whatever.social",
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

// ── Source 3: Invidious ──
async function tryInvidious(videoId: string): Promise<{ url: string; mimeType: string } | null> {
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

    let result: { url: string; mimeType: string } | null = null;

    // 1. YouTubeJS (direct extraction with signature decryption)
    if (videoId) {
      console.log(`[1/3] YouTubeJS...`);
      result = await tryYouTubeJS(videoId);
    }

    // 2. Piped
    if (!result && videoId) {
      console.log(`[2/3] Piped...`);
      result = await tryPiped(videoId);
    }

    // 3. Invidious
    if (!result && videoId) {
      console.log(`[3/3] Invidious...`);
      result = await tryInvidious(videoId);
    }

    if (!result) {
      console.error("❌ All sources failed");
      return new Response(
        JSON.stringify({
          error: "Could not find an audio source for this track. Please try again later.",
          serverOnline: false,
          success: false,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const proxyEndpoint = `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(result.url)}`;

    console.log(`✅ Audio ready!`);

    return new Response(
      JSON.stringify({
        audioUrl: proxyEndpoint,
        directUrl: result.url,
        mimeType: result.mimeType,
        serverOnline: true,
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
