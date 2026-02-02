import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

// Cobalt API - Updated format for 2025-2026
async function tryCobalt(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const instances = [
    { url: "https://api.cobalt.tools", version: "v10" },
    { url: "https://cobalt.api.timelessnesses.me", version: "v10" },
  ];
  
  for (const { url: instance, version } of instances) {
    try {
      console.log(`Trying Cobalt: ${instance}`);
      
      // New Cobalt v10 API format
      const response = await fetch(instance, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: "audio",
          audioFormat: "mp3",
        }),
        signal: AbortSignal.timeout(15000),
      });
      
      if (!response.ok) {
        console.log(`Cobalt ${instance}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      // Handle different response formats
      if (data.url) {
        console.log(`✓ Cobalt success: ${instance}`);
        return { url: data.url, mimeType: "audio/mpeg" };
      }
      
      if (data.status === "stream" || data.status === "redirect") {
        console.log(`✓ Cobalt stream success: ${instance}`);
        return { url: data.url, mimeType: "audio/mpeg" };
      }
      
      if (data.status === "picker" && data.picker) {
        const audioOption = data.picker.find((p: any) => p.type === "audio");
        if (audioOption?.url) {
          console.log(`✓ Cobalt picker success: ${instance}`);
          return { url: audioOption.url, mimeType: "audio/mpeg" };
        }
      }
      
      console.log(`Cobalt ${instance}: unexpected response`, data.status);
    } catch (error) {
      console.log(`Cobalt ${instance}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }
  
  return null;
}

// YouTube Piped API - Tested working instances
async function tryPiped(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Prioritize instances that were recently confirmed working
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.r4fo.com",
    "https://pipedapi-libre.kavin.rocks",
    "https://watchapi.whatever.social",
    "https://api.piped.projectsegfau.lt",
    "https://piped-api.garudalinux.org",
    "https://api-piped.mha.fi",
    "https://ytapi.dc09.ru",
    "https://pipedapi.rivo.lol",
  ];
  
  for (const instance of instances) {
    try {
      console.log(`Trying Piped: ${instance}`);
      
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(12000),
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      
      if (!response.ok) {
        console.log(`Piped ${instance}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`Piped ${instance}: ${data.error}`);
        continue;
      }
      
      const audioStreams = (data.audioStreams || []).filter((s: any) => s.url);
      
      if (audioStreams.length === 0) {
        console.log(`Piped ${instance}: No audio streams`);
        continue;
      }
      
      // Sort by quality (prefer m4a, highest bitrate)
      audioStreams.sort((a: any, b: any) => {
        const aM4a = a.mimeType?.includes('mp4') || a.mimeType?.includes('m4a');
        const bM4a = b.mimeType?.includes('mp4') || b.mimeType?.includes('m4a');
        if (aM4a && !bM4a) return -1;
        if (bM4a && !aM4a) return 1;
        return (b.bitrate || 0) - (a.bitrate || 0);
      });
      
      const best = audioStreams[0];
      console.log(`✓ Piped success: ${instance} (${best.bitrate}bps)`);
      
      return {
        url: best.url,
        mimeType: best.mimeType || "audio/mp4",
      };
    } catch (error) {
      console.log(`Piped ${instance}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }
  
  return null;
}

// Invidious API fallback
async function tryInvidious(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const instances = [
    "https://inv.nadeko.net",
    "https://yewtu.be",
    "https://vid.puffyan.us",
    "https://invidious.nerdvpn.de",
    "https://inv.riverside.rocks",
    "https://invidious.io.lol",
    "https://invidious.privacydev.net",
  ];
  
  for (const instance of instances) {
    try {
      console.log(`Trying Invidious: ${instance}`);
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(12000),
        headers: { 
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      
      if (!response.ok) {
        console.log(`Invidious ${instance}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const audioFormats = (data.adaptiveFormats || []).filter((f: any) =>
        f.type?.includes('audio') && f.url
      );
      
      if (audioFormats.length === 0) {
        console.log(`Invidious ${instance}: No audio formats`);
        continue;
      }
      
      // Prefer highest quality
      audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      
      const best = audioFormats[0];
      console.log(`✓ Invidious success: ${instance}`);
      
      return {
        url: best.url,
        mimeType: best.type?.split(';')[0] || "audio/mp4",
      };
    } catch (error) {
      console.log(`Invidious ${instance}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }
  
  return null;
}

// Audius - For indie/alternative tracks (always returns something)
async function tryAudius(title: string, artist?: string): Promise<{ url: string; mimeType: string; trackInfo?: any } | null> {
  const nodes = [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
    "https://discoveryprovider3.audius.co",
    "https://audius-discovery-1.altego.net",
  ];
  
  for (const node of nodes) {
    try {
      // Check health
      const healthCheck = await fetch(`${node}/health_check`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!healthCheck.ok) continue;
      
      // Clean search query
      let searchQuery = title
        .replace(/\(Official.*?\)/gi, '')
        .replace(/\[.*?\]/gi, '')
        .replace(/\(Audio\)/gi, '')
        .replace(/\(Lyrics\)/gi, '')
        .replace(/\(Video\)/gi, '')
        .replace(/Official.*?Video/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (artist) {
        searchQuery = `${artist} ${searchQuery}`.trim();
      }
      
      console.log(`Trying Audius: "${searchQuery}"`);
      
      const response = await fetch(
        `${node}/v1/tracks/search?query=${encodeURIComponent(searchQuery)}&limit=5&app_name=KHAYABEATS`,
        { 
          signal: AbortSignal.timeout(8000),
          headers: { "Accept": "application/json" }
        }
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const tracks = data.data || [];
      
      if (tracks.length === 0) continue;
      
      const track = tracks.find((t: any) => !t.is_delete && t.is_available) || tracks[0];
      
      console.log(`✓ Audius found: "${track.title}" by ${track.user?.name}`);
      
      return {
        url: `${node}/v1/tracks/${track.id}/stream?app_name=KHAYABEATS`,
        mimeType: "audio/mpeg",
        trackInfo: {
          title: track.title,
          artist: track.user?.name,
          artwork: track.artwork?.["480x480"],
          duration: track.duration,
          source: "audius",
        },
      };
    } catch {
      continue;
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
    
    // Proxy mode - stream audio through our server for CORS bypass
    const proxyUrl = url.searchParams.get("proxy");
    if (proxyUrl) {
      console.log("Proxying audio...");
      
      const decodedUrl = decodeURIComponent(proxyUrl);
      const rangeHeader = req.headers.get("range");
      
      const headers: HeadersInit = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
        "Referer": "https://www.youtube.com/",
        "Origin": "https://www.youtube.com",
      };
      
      if (rangeHeader) {
        headers["Range"] = rangeHeader;
      }
      
      const audioResponse = await fetch(decodedUrl, { 
        headers,
        signal: AbortSignal.timeout(30000),
      });
      
      if (!audioResponse.ok && audioResponse.status !== 206) {
        console.error(`Proxy upstream error: ${audioResponse.status}`);
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
      
      const contentLength = audioResponse.headers.get("content-length");
      const contentRange = audioResponse.headers.get("content-range");
      
      if (contentLength) responseHeaders["Content-Length"] = contentLength;
      if (contentRange) responseHeaders["Content-Range"] = contentRange;
      
      return new Response(audioResponse.body, {
        status: audioResponse.status,
        headers: responseHeaders,
      });
    }
    
    // Main request - find audio stream
    const body = await req.json();
    const { videoId, title, artist } = body;

    if (!videoId && !title) {
      return new Response(
        JSON.stringify({ error: "Video ID or title required", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { url: string; mimeType: string; trackInfo?: any } | null = null;
    
    // Priority: YouTube sources first (original songs), Audius as fallback (may be covers)
    if (videoId) {
      // Strategy 1: Cobalt
      console.log(`[1/4] Cobalt: ${videoId}`);
      result = await tryCobalt(videoId);
      
      // Strategy 2: Piped
      if (!result) {
        console.log(`[2/4] Piped: ${videoId}`);
        result = await tryPiped(videoId);
      }
      
      // Strategy 3: Invidious
      if (!result) {
        console.log(`[3/4] Invidious: ${videoId}`);
        result = await tryInvidious(videoId);
      }
    }
    
    // Strategy 4: Audius (fallback)
    if (!result && title) {
      console.log(`[4/4] Audius: ${title}`);
      result = await tryAudius(title, artist);
    }
    
    if (!result) {
      console.error("All sources failed");
      return new Response(
        JSON.stringify({ 
          error: "Unable to stream this track. The song may be geo-restricted or unavailable. Try another song.",
          success: false 
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create proxied URL for CORS-free playback
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const proxyEndpoint = `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(result.url)}`;
    
    return new Response(
      JSON.stringify({
        audioUrl: proxyEndpoint,
        directUrl: result.url,
        mimeType: result.mimeType,
        trackInfo: result.trackInfo,
        success: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Audio stream error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to get audio",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
