import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PRIMARY: Piped API instances (most reliable currently)
async function tryPipedAPI(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Updated list of working Piped instances as of 2025
  const PIPED_INSTANCES = [
    "https://pipedapi.r4fo.com",
    "https://pipedapi.osphost.fi",
    "https://pipedapi.leptons.xyz",
    "https://piped-api.lunar.icu",
    "https://api.piped.yt",
    "https://pipedapi.in.projectsegfau.lt",
    "https://pipedapi.colinslegacy.com",
  ];

  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`Trying Piped instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Piped ${instance} returned ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`Piped ${instance} error: ${data.error}`);
        continue;
      }
      
      const audioStreams = data.audioStreams?.filter((s: any) => s.url);
      
      if (!audioStreams || audioStreams.length === 0) {
        console.log(`No audio streams from ${instance}`);
        continue;
      }
      
      // Prefer M4A/MP4 audio (best compatibility), then highest bitrate
      const sortedStreams = audioStreams.sort((a: any, b: any) => {
        const aIsM4a = a.mimeType?.includes('mp4') || a.mimeType?.includes('m4a');
        const bIsM4a = b.mimeType?.includes('mp4') || b.mimeType?.includes('m4a');
        
        if (aIsM4a && !bIsM4a) return -1;
        if (bIsM4a && !aIsM4a) return 1;
        
        return (b.bitrate || 0) - (a.bitrate || 0);
      });
      
      const bestStream = sortedStreams[0];
      console.log(`✓ Success from Piped: ${instance}, bitrate: ${bestStream.bitrate}`);
      
      return { 
        url: bestStream.url, 
        mimeType: bestStream.mimeType || 'audio/mp4',
      };
    } catch (e) {
      console.log(`Piped ${instance} failed:`, e instanceof Error ? e.message : e);
      continue;
    }
  }
  
  return null;
}

// SECONDARY: Invidious API instances
async function tryInvidiousAPI(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Updated list of working Invidious instances
  const INVIDIOUS_INSTANCES = [
    "https://invidious.nerdvpn.de",
    "https://invidious.projectsegfau.lt",
    "https://inv.nadeko.net",
    "https://invidious.protokolla.fi",
    "https://iv.datura.network",
    "https://invidious.perennialte.ch",
  ];

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying Invidious instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: controller.signal,
        headers: { 
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Invidious ${instance} returned ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      // Look for audio-only adaptive formats
      const adaptiveFormats = data.adaptiveFormats || [];
      const audioFormats = adaptiveFormats.filter((f: any) => 
        f.type?.includes('audio') && f.url
      );
      
      if (audioFormats.length > 0) {
        // Prefer M4A, then highest bitrate
        audioFormats.sort((a: any, b: any) => {
          const aIsM4a = a.type?.includes('mp4');
          const bIsM4a = b.type?.includes('mp4');
          if (aIsM4a && !bIsM4a) return -1;
          if (bIsM4a && !aIsM4a) return 1;
          return (b.bitrate || 0) - (a.bitrate || 0);
        });
        
        const best = audioFormats[0];
        console.log(`✓ Success from Invidious: ${instance}`);
        return { url: best.url, mimeType: best.type || 'audio/mp4' };
      }
    } catch (e) {
      console.log(`Invidious ${instance} failed:`, e instanceof Error ? e.message : e);
      continue;
    }
  }
  
  return null;
}

// TERTIARY: NewPipe Extractor via public instances
async function tryNewPipeExtractor(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const EXTRACTOR_INSTANCES = [
    "https://yt.drgnz.club",
    "https://watchapi.whatever.social",
  ];

  for (const instance of EXTRACTOR_INSTANCES) {
    try {
      console.log(`Trying extractor: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const audioStreams = data.audioStreams || data.adaptiveFormats?.filter((f: any) => f.type?.includes('audio'));
      
      if (audioStreams && audioStreams.length > 0) {
        const best = audioStreams[0];
        console.log(`✓ Success from extractor: ${instance}`);
        return { url: best.url, mimeType: best.mimeType || best.type || 'audio/mp4' };
      }
    } catch (e) {
      console.log(`Extractor ${instance} failed`);
      continue;
    }
  }
  
  return null;
}

// Main handler with cascading fallbacks
async function getAudioStream(videoId: string): Promise<{ url: string; mimeType: string }> {
  console.log(`Getting audio for video: ${videoId}`);
  
  // Try all sources in parallel for speed, use first success
  const results = await Promise.allSettled([
    tryPipedAPI(videoId),
    tryInvidiousAPI(videoId),
    tryNewPipeExtractor(videoId),
  ]);
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return result.value;
    }
  }
  
  throw new Error("All audio sources failed. Please try again later.");
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
        
        // Get range header if present (for seeking)
        const rangeHeader = req.headers.get("range");
        
        const headers: HeadersInit = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.youtube.com/",
          "Origin": "https://www.youtube.com",
        };
        
        if (rangeHeader) {
          headers["Range"] = rangeHeader;
        }
        
        const audioResponse = await fetch(decodedUrl, { headers });

        if (!audioResponse.ok && audioResponse.status !== 206) {
          throw new Error(`Upstream error: ${audioResponse.status}`);
        }

        const contentType = audioResponse.headers.get("content-type") || "audio/mp4";
        const contentLength = audioResponse.headers.get("content-length");
        const contentRange = audioResponse.headers.get("content-range");
        
        const responseHeaders: HeadersInit = {
          ...corsHeaders,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        };
        
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
    
    // Main request - get audio URL
    const body = await req.json();
    const videoId = body.videoId;

    if (!videoId) {
      throw new Error("Video ID is required");
    }

    const { url: audioUrl, mimeType } = await getAudioStream(videoId);
    
    // Return proxied URL for CORS-free playback
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const proxyEndpoint = `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(audioUrl)}`;
    
    return new Response(
      JSON.stringify({ 
        audioUrl: proxyEndpoint,
        directUrl: audioUrl,
        mimeType,
        success: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Audio stream error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to get audio",
        success: false 
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
