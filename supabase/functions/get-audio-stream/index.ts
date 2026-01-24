import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dynamic Piped instances with better health checking
async function getPipedInstances(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch("https://piped-instances.kavin.rocks/", {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return getDefaultPipedInstances();
    }
    
    const instances = await response.json();
    
    // Filter healthy instances with good uptime
    const workingInstances = instances
      .filter((inst: any) => 
        inst.api_url && 
        inst.uptime_24h > 95 &&
        !inst.api_url.includes("localhost")
      )
      .sort((a: any, b: any) => (b.uptime_24h || 0) - (a.uptime_24h || 0))
      .slice(0, 10)
      .map((inst: any) => inst.api_url);
    
    console.log(`Found ${workingInstances.length} healthy Piped instances`);
    return workingInstances.length > 0 ? workingInstances : getDefaultPipedInstances();
  } catch (e) {
    console.log("Error fetching Piped instances, using defaults");
    return getDefaultPipedInstances();
  }
}

function getDefaultPipedInstances(): string[] {
  return [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.private.coffee",
    "https://pipedapi.darkness.services",
    "https://pipedapi.drgns.space",
    "https://pipedapi.in.projectsegfau.lt",
    "https://pipedapi.moomoo.me",
  ];
}

// Try multiple sources for audio
async function getAudioStream(videoId: string): Promise<{ url: string; mimeType: string; duration?: number }> {
  const instances = await getPipedInstances();
  let lastError = "";
  
  for (const instance of instances) {
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
        lastError = data.error;
        continue;
      }
      
      const audioStreams = data.audioStreams?.filter((s: any) => s.url);
      
      if (!audioStreams || audioStreams.length === 0) {
        console.log(`No audio streams from ${instance}`);
        continue;
      }
      
      // Sort: prefer MP4/M4A, then highest bitrate
      const sortedStreams = audioStreams.sort((a: any, b: any) => {
        const aIsM4a = a.mimeType?.includes('mp4') || a.mimeType?.includes('m4a');
        const bIsM4a = b.mimeType?.includes('mp4') || b.mimeType?.includes('m4a');
        
        if (aIsM4a && !bIsM4a) return -1;
        if (bIsM4a && !aIsM4a) return 1;
        
        return (b.bitrate || 0) - (a.bitrate || 0);
      });
      
      const bestStream = sortedStreams[0];
      console.log(`Success! Got audio from ${instance}, mime: ${bestStream.mimeType}, bitrate: ${bestStream.bitrate}`);
      
      return { 
        url: bestStream.url, 
        mimeType: bestStream.mimeType || 'audio/mp4',
        duration: data.duration,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.log(`Piped ${instance} failed: ${errorMsg}`);
      lastError = errorMsg;
      continue;
    }
  }
  
  throw new Error(lastError || "No audio source available");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Check if this is a proxy request
    const proxyUrl = url.searchParams.get("proxy");
    if (proxyUrl) {
      console.log("Proxying audio stream...");
      
      try {
        const audioResponse = await fetch(decodeURIComponent(proxyUrl), {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "identity", // Don't request compression for audio
            "Range": "bytes=0-", // Request full file
          },
        });

        if (!audioResponse.ok) {
          throw new Error(`Upstream error: ${audioResponse.status}`);
        }

        const contentType = audioResponse.headers.get("content-type") || "audio/mp4";
        const contentLength = audioResponse.headers.get("content-length");
        
        // Stream the response directly
        return new Response(audioResponse.body, {
          status: audioResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": contentType,
            ...(contentLength && { "Content-Length": contentLength }),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600",
          },
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
    const { videoId } = await req.json();

    if (!videoId) {
      throw new Error("Video ID is required");
    }

    console.log(`Fetching audio for video: ${videoId}`);

    const { url: audioUrl, mimeType, duration } = await getAudioStream(videoId);
    
    // Return the URL with proxy endpoint for CORS-free playback
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const proxyEndpoint = `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(audioUrl)}`;
    
    return new Response(
      JSON.stringify({ 
        audioUrl: proxyEndpoint,
        directUrl: audioUrl,
        mimeType,
        duration,
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
