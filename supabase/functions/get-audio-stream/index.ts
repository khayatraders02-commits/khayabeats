import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

// YOUR PRIVATE YT-DLP SERVER URL
// Set this in Supabase secrets or update before production
const YT_SERVER_URL = Deno.env.get("KHAYABEATS_SERVER_URL") || "";

// Try your private yt-dlp server first
async function tryYTServer(videoId: string, title?: string, artist?: string): Promise<{ url: string; mimeType: string } | null> {
  if (!YT_SERVER_URL) {
    console.log("[YT-Server] No server URL configured");
    return null;
  }
  
  try {
    console.log(`[YT-Server] Trying: ${YT_SERVER_URL}`);
    
    const response = await fetch(`${YT_SERVER_URL}/audio-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, title, artist }),
      signal: AbortSignal.timeout(30000), // Allow longer for downloads
    });
    
    if (!response.ok) {
      console.log(`[YT-Server] HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.audioUrl) {
      console.log(`✓ [YT-Server] Success! Cached: ${data.cached}`);
      return {
        url: data.audioUrl,
        mimeType: "audio/mpeg",
      };
    }
    
    return null;
  } catch (error) {
    console.log(`[YT-Server] Error: ${error instanceof Error ? error.message : 'failed'}`);
    return null;
  }
}

// PIPED API - Fallback when yt-server is offline
async function tryPiped(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const instances = [
    "https://pipedapi.r4fo.com",
    "https://pipedapi.aeong.one",
    "https://api.piped.projectsegfau.lt",
    "https://pipedapi.smnz.de",
  ];
  
  for (const instance of instances) {
    try {
      console.log(`[Piped] Trying: ${instance}`);
      
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(6000),
        headers: { "Accept": "application/json" },
      });
      
      if (!response.ok) {
        console.log(`[Piped] ${instance}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      if (data.error) continue;
      
      const audioStreams = (data.audioStreams || []).filter((s: any) => s.url);
      if (audioStreams.length === 0) continue;
      
      audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      const best = audioStreams[0];
      
      console.log(`✓ [Piped] Success from ${instance}`);
      return { url: best.url, mimeType: best.mimeType || "audio/mp4" };
    } catch (error) {
      console.log(`[Piped] ${instance}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }
  
  return null;
}

// INVIDIOUS - Another fallback
async function tryInvidious(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const instances = [
    "https://inv.odyssey346.dev",
    "https://invidious.private.coffee",
    "https://iv.nbooz.de",
    "https://invidious.io.lol",
  ];
  
  for (const instance of instances) {
    try {
      console.log(`[Invidious] Trying: ${instance}`);
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(6000),
        headers: { "Accept": "application/json" },
      });
      
      if (!response.ok) {
        console.log(`[Invidious] ${instance}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const audioFormats = (data.adaptiveFormats || []).filter((f: any) =>
        f.type?.includes('audio') && f.url
      );
      
      if (audioFormats.length === 0) continue;
      
      audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      
      console.log(`✓ [Invidious] Success from ${instance}`);
      return {
        url: audioFormats[0].url,
        mimeType: audioFormats[0].type?.split(';')[0] || "audio/mp4",
      };
    } catch (error) {
      console.log(`[Invidious] ${instance}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }
  
  return null;
}

// AUDIUS - Decentralized music (reliable for indie)
async function tryAudius(title: string, artist?: string): Promise<{ url: string; mimeType: string; trackInfo?: any } | null> {
  const nodes = [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
    "https://discoveryprovider3.audius.co",
  ];
  
  for (const node of nodes) {
    try {
      const health = await fetch(`${node}/health_check`, { signal: AbortSignal.timeout(2000) });
      if (!health.ok) continue;
      
      let query = title
        .replace(/\(Official.*?\)/gi, '')
        .replace(/\[.*?\]/gi, '')
        .replace(/\(Audio\)/gi, '')
        .replace(/\(Lyrics\)/gi, '')
        .replace(/ft\..*/gi, '')
        .replace(/feat\..*/gi, '')
        .trim();
      
      if (artist) query = `${artist} ${query}`.trim();
      
      console.log(`[Audius] Searching: "${query}"`);
      
      const response = await fetch(
        `${node}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=25&app_name=KHAYABEATS`,
        { signal: AbortSignal.timeout(8000) }
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const tracks = data.data || [];
      
      if (tracks.length === 0) {
        console.log(`[Audius] No tracks found`);
        continue;
      }
      
      const validTracks = tracks.filter((t: any) => !t.is_delete && t.is_available);
      
      const track = validTracks.find((t: any) => {
        const lowerTitle = t.title?.toLowerCase() || '';
        return !/cover|remix|instrumental|karaoke|tribute|bootleg/i.test(lowerTitle);
      }) || validTracks[0];
      
      if (!track) continue;
      
      const isCover = /cover|remix|instrumental|karaoke/i.test(track.title);
      console.log(`✓ [Audius] Found: "${track.title}" by ${track.user?.name}${isCover ? ' (cover)' : ''}`);
      
      return {
        url: `${node}/v1/tracks/${track.id}/stream?app_name=KHAYABEATS`,
        mimeType: "audio/mpeg",
        trackInfo: {
          title: track.title,
          artist: track.user?.name,
          artwork: track.artwork?.["480x480"],
          source: "audius",
          isCover,
          originalQuery: query,
        },
      };
    } catch (error) {
      console.log(`[Audius] ${node}: ${error instanceof Error ? error.message : 'failed'}`);
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
    
    // PROXY MODE - Stream audio through our server
    const proxyUrl = url.searchParams.get("proxy");
    if (proxyUrl) {
      console.log("[Proxy] Streaming audio...");
      
      const decodedUrl = decodeURIComponent(proxyUrl);
      const rangeHeader = req.headers.get("range");
      
      const headers: HeadersInit = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://www.youtube.com/",
      };
      
      if (rangeHeader) headers["Range"] = rangeHeader;
      
      const audioResponse = await fetch(decodedUrl, { 
        headers,
        signal: AbortSignal.timeout(30000),
      });
      
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
      
      const contentLength = audioResponse.headers.get("content-length");
      const contentRange = audioResponse.headers.get("content-range");
      if (contentLength) responseHeaders["Content-Length"] = contentLength;
      if (contentRange) responseHeaders["Content-Range"] = contentRange;
      
      return new Response(audioResponse.body, {
        status: audioResponse.status,
        headers: responseHeaders,
      });
    }
    
    // MAIN REQUEST
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
    
    // Strategy 1: Try YOUR private yt-dlp server FIRST (best quality, reliable)
    if (videoId && YT_SERVER_URL) {
      console.log(`[1/4] Your yt-dlp server...`);
      result = await tryYTServer(videoId, title, artist);
      if (result) {
        serverOnline = true;
      }
    }
    
    // Strategy 2: Fall back to Piped (YouTube proxy)
    if (!result && videoId) {
      console.log(`[2/4] Piped...`);
      result = await tryPiped(videoId);
    }
    
    // Strategy 3: Invidious 
    if (!result && videoId) {
      console.log(`[3/4] Invidious...`);
      result = await tryInvidious(videoId);
    }
    
    // Strategy 4: Audius (for indie music)
    if (!result && title) {
      console.log(`[4/4] Audius...`);
      result = await tryAudius(title, artist);
    }
    
    if (!result) {
      console.error("❌ All sources failed");
      return new Response(
        JSON.stringify({ 
          error: "Unable to stream this track. Try a different song or check if the server is running.",
          serverOnline: false,
          success: false,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create proxied URL (unless it's already from your server)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const isYTServerUrl = result.url.includes("localhost") || result.url.includes("3001");
    const proxyEndpoint = isYTServerUrl 
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
