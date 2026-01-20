import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Multiple API sources for reliability
const AUDIO_SOURCES = [
  {
    name: "cobalt",
    getUrl: async (videoId: string) => {
      const response = await fetch("https://api.cobalt.tools/", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: "audio",
          audioFormat: "mp3",
        }),
      });
      
      if (!response.ok) throw new Error(`Cobalt error: ${response.status}`);
      const data = await response.json();
      if (!data.url) throw new Error("No URL from Cobalt");
      return data.url;
    },
  },
  {
    name: "cobalt-eu",
    getUrl: async (videoId: string) => {
      const response = await fetch("https://eu.cobalt.best/", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: "audio",
          audioFormat: "mp3",
        }),
      });
      
      if (!response.ok) throw new Error(`Cobalt EU error: ${response.status}`);
      const data = await response.json();
      if (!data.url) throw new Error("No URL from Cobalt EU");
      return data.url;
    },
  },
  {
    name: "invidious",
    getUrl: async (videoId: string) => {
      // Try multiple Invidious instances
      const instances = [
        "https://inv.nadeko.net",
        "https://invidious.nerdvpn.de",
        "https://invidious.jing.rocks",
      ];
      
      for (const instance of instances) {
        try {
          const response = await fetch(`${instance}/api/v1/videos/${videoId}`);
          if (!response.ok) continue;
          
          const data = await response.json();
          const audioFormats = data.adaptiveFormats?.filter((f: any) => 
            f.type?.includes("audio") && f.url
          );
          
          if (audioFormats && audioFormats.length > 0) {
            // Sort by bitrate and get best quality
            audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
            return audioFormats[0].url;
          }
        } catch (e) {
          console.log(`Invidious instance ${instance} failed:`, e);
          continue;
        }
      }
      throw new Error("No Invidious instance worked");
    },
  },
  {
    name: "piped",
    getUrl: async (videoId: string) => {
      const instances = [
        "https://pipedapi.kavin.rocks",
        "https://pipedapi.adminforge.de",
        "https://api.piped.yt",
      ];
      
      for (const instance of instances) {
        try {
          const response = await fetch(`${instance}/streams/${videoId}`);
          if (!response.ok) continue;
          
          const data = await response.json();
          const audioStreams = data.audioStreams?.filter((s: any) => s.url);
          
          if (audioStreams && audioStreams.length > 0) {
            // Get highest bitrate audio
            audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
            return audioStreams[0].url;
          }
        } catch (e) {
          console.log(`Piped instance ${instance} failed:`, e);
          continue;
        }
      }
      throw new Error("No Piped instance worked");
    },
  },
];

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

    // Try each source in order until one works
    let lastError: Error | null = null;
    
    for (const source of AUDIO_SOURCES) {
      try {
        console.log(`Trying source: ${source.name}`);
        const audioUrl = await source.getUrl(videoId);
        
        console.log(`Success with ${source.name}!`);
        
        return new Response(
          JSON.stringify({ 
            audioUrl, 
            success: true,
            source: source.name,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error(`${source.name} failed:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    // All sources failed
    throw lastError || new Error("All audio sources failed");
    
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
