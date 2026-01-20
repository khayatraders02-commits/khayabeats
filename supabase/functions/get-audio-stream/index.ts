import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dynamically fetch working Piped instances
async function getPipedInstances(): Promise<string[]> {
  try {
    const response = await fetch("https://piped-instances.kavin.rocks/", {
      headers: { "Accept": "application/json" },
    });
    
    if (!response.ok) {
      console.log("Failed to fetch Piped instances list");
      return getDefaultPipedInstances();
    }
    
    const instances = await response.json();
    
    // Filter for healthy instances with good uptime
    const workingInstances = instances
      .filter((inst: any) => 
        inst.api_url && 
        inst.uptime_24h > 90
      )
      .sort((a: any, b: any) => (b.uptime_24h || 0) - (a.uptime_24h || 0))
      .slice(0, 8)
      .map((inst: any) => inst.api_url);
    
    console.log(`Found ${workingInstances.length} healthy Piped instances`);
    return workingInstances.length > 0 ? workingInstances : getDefaultPipedInstances();
  } catch (e) {
    console.log("Error fetching Piped instances:", e);
    return getDefaultPipedInstances();
  }
}

function getDefaultPipedInstances(): string[] {
  return [
    "https://api.piped.private.coffee",
    "https://pipedapi.darkness.services",
    "https://pipedapi.drgns.space",
    "https://pipedapi.in.projectsegfau.lt",
  ];
}

async function getAudioFromPiped(videoId: string): Promise<{ url: string; mimeType: string }> {
  const instances = await getPipedInstances();
  
  for (const instance of instances) {
    try {
      console.log(`Trying Piped instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "User-Agent": "KhayaBeats/1.0",
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Piped instance ${instance} returned ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`Piped instance ${instance} error: ${data.error}`);
        continue;
      }
      
      const audioStreams = data.audioStreams?.filter((s: any) => s.url);
      
      if (audioStreams && audioStreams.length > 0) {
        // Prefer MP4/M4A formats for better browser compatibility, then webm
        const sortedStreams = audioStreams.sort((a: any, b: any) => {
          // Prioritize MP4/M4A over WebM for compatibility
          const aIsM4a = a.mimeType?.includes('mp4') || a.mimeType?.includes('m4a');
          const bIsM4a = b.mimeType?.includes('mp4') || b.mimeType?.includes('m4a');
          
          if (aIsM4a && !bIsM4a) return -1;
          if (bIsM4a && !aIsM4a) return 1;
          
          // Then sort by bitrate
          return (b.bitrate || 0) - (a.bitrate || 0);
        });
        
        const bestStream = sortedStreams[0];
        console.log(`Success! Got audio from ${instance}, mime: ${bestStream.mimeType}`);
        return { 
          url: bestStream.url, 
          mimeType: bestStream.mimeType || 'audio/webm' 
        };
      }
      
      console.log(`Piped instance ${instance} returned no audio streams`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.log(`Piped instance ${instance} failed: ${errorMsg}`);
      continue;
    }
  }
  
  throw new Error("No Piped instance could provide audio");
}

// Proxy the audio stream through our edge function to avoid CORS issues
async function proxyAudioStream(audioUrl: string): Promise<Response> {
  const response = await fetch(audioUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Range": "bytes=0-",
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status}`);
  }
  
  const contentType = response.headers.get("content-type") || "audio/webm";
  const contentLength = response.headers.get("content-length");
  
  return new Response(response.body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      ...(contentLength && { "Content-Length": contentLength }),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
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
      return await proxyAudioStream(decodeURIComponent(proxyUrl));
    }
    
    const { videoId } = await req.json();

    if (!videoId) {
      throw new Error("Video ID is required");
    }

    console.log(`Fetching audio for video: ${videoId}`);

    try {
      const { url: audioUrl, mimeType } = await getAudioFromPiped(videoId);
      
      // Return the URL with proxy endpoint for CORS-free playback
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const proxyEndpoint = `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(audioUrl)}`;
      
      return new Response(
        JSON.stringify({ 
          audioUrl: proxyEndpoint,
          directUrl: audioUrl, // Also provide direct URL as fallback
          mimeType,
          success: true,
          source: "piped",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (pipedError) {
      console.error("All Piped sources failed:", pipedError);
      
      return new Response(
        JSON.stringify({ 
          error: "Audio streaming temporarily unavailable. Please try again later.",
          details: pipedError instanceof Error ? pipedError.message : "Unknown error",
          success: false 
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
  } catch (error) {
    console.error("Audio stream error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to get audio",
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
