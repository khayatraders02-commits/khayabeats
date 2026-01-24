import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Audius Discovery Nodes (stable, reliable, free)
const AUDIUS_DISCOVERY_NODES = [
  "https://discoveryprovider.audius.co",
  "https://discoveryprovider2.audius.co",
  "https://discoveryprovider3.audius.co",
  "https://dn1.monophonic.digital",
  "https://dn2.monophonic.digital",
];

// Get a working Audius discovery node
async function getAudiusNode(): Promise<string> {
  for (const node of AUDIUS_DISCOVERY_NODES) {
    try {
      const response = await fetch(`${node}/health_check`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        console.log(`Using Audius node: ${node}`);
        return node;
      }
    } catch {
      continue;
    }
  }
  return AUDIUS_DISCOVERY_NODES[0];
}

// PRIMARY: Search and stream from Audius (stable, free, 320kbps)
async function tryAudius(title: string, artist?: string): Promise<{ url: string; mimeType: string; trackInfo?: any } | null> {
  try {
    const node = await getAudiusNode();
    const searchQuery = artist ? `${title} ${artist}` : title;
    
    console.log(`Searching Audius for: ${searchQuery}`);
    
    const searchUrl = `${node}/v1/tracks/search?query=${encodeURIComponent(searchQuery)}&app_name=KHAYABEATS`;
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "Accept": "application/json" },
    });
    
    if (!response.ok) {
      console.log(`Audius search failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const tracks = data.data || [];
    
    if (tracks.length === 0) {
      console.log("No tracks found on Audius");
      return null;
    }
    
    // Find best match
    const track = tracks[0];
    const trackId = track.id;
    
    // Get stream URL
    const streamUrl = `${node}/v1/tracks/${trackId}/stream?app_name=KHAYABEATS`;
    
    console.log(`✓ Found on Audius: "${track.title}" by ${track.user?.name}`);
    
    return {
      url: streamUrl,
      mimeType: "audio/mpeg",
      trackInfo: {
        title: track.title,
        artist: track.user?.name,
        artwork: track.artwork?.["480x480"] || track.artwork?.["1000x1000"],
        duration: track.duration,
      },
    };
  } catch (error) {
    console.error("Audius error:", error);
    return null;
  }
}

// SECONDARY: Cobalt API (reliable YouTube audio extraction)
async function tryCobalt(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const COBALT_INSTANCES = [
    "https://api.cobalt.tools",
    "https://co.wuk.sh",
  ];
  
  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`Trying Cobalt: ${instance}`);
      
      const response = await fetch(`${instance}/api/json`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          vCodec: "h264",
          vQuality: "720",
          aFormat: "mp3",
          isAudioOnly: true,
          filenamePattern: "basic",
        }),
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.status === "stream" || data.status === "redirect") {
        console.log(`✓ Success from Cobalt: ${instance}`);
        return {
          url: data.url,
          mimeType: "audio/mpeg",
        };
      }
    } catch (error) {
      console.log(`Cobalt ${instance} failed:`, error instanceof Error ? error.message : error);
      continue;
    }
  }
  
  return null;
}

// TERTIARY: Piped instances (as fallback)
async function tryPiped(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.tokhmi.xyz",
    "https://api.piped.privacydev.net",
  ];
  
  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`Trying Piped: ${instance}`);
      
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.error) continue;
      
      const audioStreams = data.audioStreams?.filter((s: any) => s.url);
      
      if (!audioStreams || audioStreams.length === 0) continue;
      
      // Prefer M4A, then highest bitrate
      audioStreams.sort((a: any, b: any) => {
        const aIsM4a = a.mimeType?.includes('mp4');
        const bIsM4a = b.mimeType?.includes('mp4');
        if (aIsM4a && !bIsM4a) return -1;
        if (bIsM4a && !aIsM4a) return 1;
        return (b.bitrate || 0) - (a.bitrate || 0);
      });
      
      const best = audioStreams[0];
      console.log(`✓ Success from Piped: ${instance}`);
      
      return {
        url: best.url,
        mimeType: best.mimeType || "audio/mp4",
      };
    } catch (error) {
      console.log(`Piped ${instance} failed:`, error instanceof Error ? error.message : error);
      continue;
    }
  }
  
  return null;
}

// QUATERNARY: Invidious instances (last resort)
async function tryInvidious(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const INVIDIOUS_INSTANCES = [
    "https://invidious.fdn.fr",
    "https://invidious.slipfox.xyz",
    "https://yewtu.be",
  ];
  
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying Invidious: ${instance}`);
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "Accept": "application/json" },
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const audioFormats = (data.adaptiveFormats || []).filter((f: any) => 
        f.type?.includes('audio') && f.url
      );
      
      if (audioFormats.length === 0) continue;
      
      audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      
      const best = audioFormats[0];
      console.log(`✓ Success from Invidious: ${instance}`);
      
      return {
        url: best.url,
        mimeType: best.type || "audio/mp4",
      };
    } catch (error) {
      console.log(`Invidious ${instance} failed:`, error instanceof Error ? error.message : error);
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
    
    // Handle proxy requests (for CORS bypass)
    const proxyUrl = url.searchParams.get("proxy");
    if (proxyUrl) {
      console.log("Proxying audio stream...");
      
      try {
        const decodedUrl = decodeURIComponent(proxyUrl);
        const rangeHeader = req.headers.get("range");
        
        const headers: HeadersInit = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "*/*",
          "Referer": "https://audius.co/",
        };
        
        if (rangeHeader) {
          headers["Range"] = rangeHeader;
        }
        
        const audioResponse = await fetch(decodedUrl, { headers });

        if (!audioResponse.ok && audioResponse.status !== 206) {
          throw new Error(`Upstream error: ${audioResponse.status}`);
        }

        const responseHeaders: HeadersInit = {
          ...corsHeaders,
          "Content-Type": audioResponse.headers.get("content-type") || "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        };
        
        const contentLength = audioResponse.headers.get("content-length");
        const contentRange = audioResponse.headers.get("content-range");
        
        if (contentLength) responseHeaders["Content-Length"] = contentLength;
        if (contentRange) responseHeaders["Content-Range"] = contentRange;
        
        return new Response(audioResponse.body, {
          status: audioResponse.status,
          headers: responseHeaders,
        });
      } catch (proxyError) {
        console.error("Proxy error:", proxyError);
        return new Response(
          JSON.stringify({ error: "Failed to proxy audio", success: false }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Main request - get audio
    const body = await req.json();
    const { videoId, title, artist, useAudius = true } = body;

    if (!videoId && !title) {
      throw new Error("Video ID or title is required");
    }

    let result: { url: string; mimeType: string; trackInfo?: any } | null = null;
    
    // Strategy 1: Try Audius first if we have title (most stable)
    if (useAudius && title) {
      console.log(`Strategy 1: Trying Audius for "${title}"`);
      result = await tryAudius(title, artist);
    }
    
    // Strategy 2: Try Cobalt for YouTube
    if (!result && videoId) {
      console.log(`Strategy 2: Trying Cobalt for videoId: ${videoId}`);
      result = await tryCobalt(videoId);
    }
    
    // Strategy 3: Try Piped
    if (!result && videoId) {
      console.log(`Strategy 3: Trying Piped for videoId: ${videoId}`);
      result = await tryPiped(videoId);
    }
    
    // Strategy 4: Try Invidious
    if (!result && videoId) {
      console.log(`Strategy 4: Trying Invidious for videoId: ${videoId}`);
      result = await tryInvidious(videoId);
    }
    
    if (!result) {
      throw new Error("All audio sources failed. Please try a different song.");
    }
    
    // Return proxied URL for CORS-free playback
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
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
