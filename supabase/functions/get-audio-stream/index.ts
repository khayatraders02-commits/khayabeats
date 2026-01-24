import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

// Audius Discovery Nodes - verified working January 2025
const AUDIUS_NODES = [
  "https://discoveryprovider.audius.co",
  "https://discoveryprovider2.audius.co", 
  "https://discoveryprovider3.audius.co",
  "https://audius-discovery-1.altego.net",
  "https://audius-discovery-2.altego.net",
];

// Get a healthy Audius node
async function getWorkingAudiusNode(): Promise<string | null> {
  for (const node of AUDIUS_NODES) {
    try {
      const response = await fetch(`${node}/health_check`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        console.log(`✓ Audius node healthy: ${node}`);
        return node;
      }
    } catch {
      continue;
    }
  }
  console.log("No healthy Audius nodes found");
  return null;
}

// Search and stream from Audius
async function tryAudius(title: string, artist?: string): Promise<{ url: string; mimeType: string; trackInfo?: any } | null> {
  const node = await getWorkingAudiusNode();
  if (!node) return null;
  
  try {
    // Clean search query - remove common noise
    let searchQuery = title
      .replace(/\(Official.*?\)/gi, '')
      .replace(/\[Official.*?\]/gi, '')
      .replace(/\(Audio\)/gi, '')
      .replace(/\(Lyrics\)/gi, '')
      .replace(/\(Video\)/gi, '')
      .replace(/\(Visualizer\)/gi, '')
      .replace(/Official Music Video/gi, '')
      .replace(/Official Video/gi, '')
      .replace(/Official Audio/gi, '')
      .replace(/lyrics/gi, '')
      .replace(/HD|HQ|4K/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (artist) {
      searchQuery = `${searchQuery} ${artist}`.trim();
    }
    
    console.log(`Searching Audius: "${searchQuery}"`);
    
    const response = await fetch(
      `${node}/v1/tracks/search?query=${encodeURIComponent(searchQuery)}&limit=5&app_name=KHAYABEATS`,
      { 
        signal: AbortSignal.timeout(8000),
        headers: { "Accept": "application/json" }
      }
    );
    
    if (!response.ok) {
      console.log(`Audius search HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const tracks = data.data || [];
    
    if (tracks.length === 0) {
      console.log("No Audius results");
      return null;
    }
    
    // Pick best match - prefer streamable tracks
    const track = tracks.find((t: any) => !t.is_delete && t.is_available) || tracks[0];
    
    console.log(`✓ Audius found: "${track.title}" by ${track.user?.name}`);
    
    return {
      url: `${node}/v1/tracks/${track.id}/stream?app_name=KHAYABEATS`,
      mimeType: "audio/mpeg",
      trackInfo: {
        title: track.title,
        artist: track.user?.name,
        artwork: track.artwork?.["480x480"] || track.artwork?.["1000x1000"],
        duration: track.duration,
        source: "audius",
      },
    };
  } catch (error) {
    console.error("Audius error:", error);
    return null;
  }
}

// YouTube Piped API - verified working instances
async function tryPiped(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // These are the most reliable Piped instances as of 2025
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.r4fo.com", 
    "https://pipedapi.adminforge.de",
    "https://pipedapi.in.projectsegfau.lt",
  ];
  
  for (const instance of instances) {
    try {
      console.log(`Trying Piped: ${instance}`);
      
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(10000),
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
      
      // Get audio streams
      const audioStreams = (data.audioStreams || []).filter((s: any) => s.url);
      
      if (audioStreams.length === 0) {
        console.log(`Piped ${instance}: No audio streams`);
        continue;
      }
      
      // Sort: prefer m4a, then highest bitrate
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
    "https://invidious.privacyredirect.com",
    "https://inv.nadeko.net",
    "https://invidious.protokolla.fi",
    "https://iv.nboeck.de",
  ];
  
  for (const instance of instances) {
    try {
      console.log(`Trying Invidious: ${instance}`);
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(10000),
        headers: { "Accept": "application/json" },
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const audioFormats = (data.adaptiveFormats || []).filter((f: any) =>
        f.type?.includes('audio') && f.url
      );
      
      if (audioFormats.length === 0) continue;
      
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

// NewPipe Extractor API
async function tryNewPipe(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const instances = [
    "https://yt.drgnz.club",
    "https://nyc1.aethernet.io",
  ];
  
  for (const instance of instances) {
    try {
      console.log(`Trying NewPipe: ${instance}`);
      
      const response = await fetch(`${instance}/api/v1/streams/${videoId}`, {
        signal: AbortSignal.timeout(10000),
        headers: { "Accept": "application/json" },
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const audioStreams = (data.audioStreams || []).filter((s: any) => s.url);
      
      if (audioStreams.length === 0) continue;
      
      audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      
      const best = audioStreams[0];
      console.log(`✓ NewPipe success: ${instance}`);
      
      return {
        url: best.url,
        mimeType: best.format?.mimeType || "audio/mp4",
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
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
    
    // Strategy 1: Audius (most stable, indie tracks)
    if (title) {
      console.log(`[1/4] Audius search: "${title}"`);
      result = await tryAudius(title, artist);
    }
    
    // Strategy 2: Piped (YouTube alternative frontend)
    if (!result && videoId) {
      console.log(`[2/4] Piped: ${videoId}`);
      result = await tryPiped(videoId);
    }
    
    // Strategy 3: Invidious (YouTube alternative)
    if (!result && videoId) {
      console.log(`[3/4] Invidious: ${videoId}`);
      result = await tryInvidious(videoId);
    }
    
    // Strategy 4: NewPipe extractor
    if (!result && videoId) {
      console.log(`[4/4] NewPipe: ${videoId}`);
      result = await tryNewPipe(videoId);
    }
    
    if (!result) {
      console.error("All sources failed");
      return new Response(
        JSON.stringify({ 
          error: "All audio sources failed. Please try a different song.",
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
