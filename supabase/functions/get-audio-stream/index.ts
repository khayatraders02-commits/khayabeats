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
        inst.uptime_24h > 90 &&
        !inst.registration_disabled
      )
      .sort((a: any, b: any) => (b.uptime_24h || 0) - (a.uptime_24h || 0))
      .slice(0, 5)
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
  ];
}

async function getAudioFromPiped(videoId: string): Promise<string> {
  const instances = await getPipedInstances();
  
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
        // Sort by bitrate, prefer higher quality
        audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        console.log(`Success! Got audio from ${instance}`);
        return audioStreams[0].url;
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

// Fallback: Use YouTube's direct embed URL (limited but works)
async function getYouTubeDirectUrl(videoId: string): Promise<string> {
  // This returns an embeddable URL that can work for some use cases
  // Note: This is a fallback and may have limitations
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  
  // Validate the video exists
  const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
  
  if (!response.ok) {
    throw new Error("Video not found on YouTube");
  }
  
  // Return a playable URL using a YouTube music proxy service
  // Using noembed as a simple validation, actual audio would need client-side handling
  throw new Error("Direct YouTube fallback not available");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();

    if (!videoId) {
      throw new Error("Video ID is required");
    }

    console.log(`Fetching audio for video: ${videoId}`);

    // Try Piped instances with dynamic list
    try {
      const audioUrl = await getAudioFromPiped(videoId);
      
      return new Response(
        JSON.stringify({ 
          audioUrl, 
          success: true,
          source: "piped",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (pipedError) {
      console.error("All Piped sources failed:", pipedError);
      
      // Return a more helpful error
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
