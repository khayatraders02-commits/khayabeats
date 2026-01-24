import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PRIMARY: Cobalt API (most reliable for YouTube audio extraction)
async function tryCobalAPI(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const COBALT_INSTANCES = [
    "https://api.cobalt.tools",
    "https://co.wuk.sh",
    "https://cobalt.api.timelessnesses.me",
  ];

  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`Trying Cobalt instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`${instance}/api/json`, {
        method: "POST",
        signal: controller.signal,
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
          disableMetadata: true,
        }),
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Cobalt ${instance} returned ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.status === "stream" || data.status === "redirect" || data.status === "picker") {
        const audioUrl = data.url || data.audio;
        if (audioUrl) {
          console.log(`Success from Cobalt: ${instance}`);
          return { url: audioUrl, mimeType: "audio/mpeg" };
        }
      }
      
    } catch (e) {
      console.log(`Cobalt ${instance} failed:`, e);
      continue;
    }
  }
  
  return null;
}

// SECONDARY: Piped API (YouTube frontend alternative)
async function tryPipedAPI(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://api.piped.private.coffee",
    "https://pipedapi.darkness.services",
    "https://pipedapi.drgns.space",
    "https://pipedapi.moomoo.me",
  ];

  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`Trying Piped instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "User-Agent": "KhayaBeats/1.0",
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
      
      // Prefer MP4/M4A audio, then highest bitrate
      const sortedStreams = audioStreams.sort((a: any, b: any) => {
        const aIsM4a = a.mimeType?.includes('mp4') || a.mimeType?.includes('m4a');
        const bIsM4a = b.mimeType?.includes('mp4') || b.mimeType?.includes('m4a');
        
        if (aIsM4a && !bIsM4a) return -1;
        if (bIsM4a && !aIsM4a) return 1;
        
        return (b.bitrate || 0) - (a.bitrate || 0);
      });
      
      const bestStream = sortedStreams[0];
      console.log(`Success from Piped: ${instance}, mime: ${bestStream.mimeType}`);
      
      return { 
        url: bestStream.url, 
        mimeType: bestStream.mimeType || 'audio/mp4',
      };
    } catch (e) {
      console.log(`Piped ${instance} failed:`, e);
      continue;
    }
  }
  
  return null;
}

// TERTIARY: Invidious API (another YouTube alternative frontend)
async function tryInvidiousAPI(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const INVIDIOUS_INSTANCES = [
    "https://invidious.fdn.fr",
    "https://vid.puffyan.us",
    "https://invidious.privacydev.net",
    "https://y.com.sb",
  ];

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying Invidious instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        continue;
      }
      
      const data = await response.json();
      
      // Look for audio-only adaptive formats
      const adaptiveFormats = data.adaptiveFormats || [];
      const audioFormats = adaptiveFormats.filter((f: any) => 
        f.type?.includes('audio') && f.url
      );
      
      if (audioFormats.length > 0) {
        // Prefer highest bitrate audio
        audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        const best = audioFormats[0];
        console.log(`Success from Invidious: ${instance}`);
        return { url: best.url, mimeType: best.type || 'audio/mp4' };
      }
    } catch (e) {
      console.log(`Invidious ${instance} failed:`, e);
      continue;
    }
  }
  
  return null;
}

// Main handler with cascading fallbacks
async function getAudioStream(videoId: string): Promise<{ url: string; mimeType: string }> {
  console.log(`Getting audio for video: ${videoId}`);
  
  // Try sources in order of reliability
  let result = await tryCobalAPI(videoId);
  if (result) return result;
  
  result = await tryPipedAPI(videoId);
  if (result) return result;
  
  result = await tryInvidiousAPI(videoId);
  if (result) return result;
  
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
