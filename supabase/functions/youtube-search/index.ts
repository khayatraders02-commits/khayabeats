import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, maxResults = 20 } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_API_KEY is not configured");
    }

    if (!query) {
      throw new Error("Search query is required");
    }

    // Search for music videos
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", `${query} audio`);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("videoCategoryId", "10"); // Music category
    searchUrl.searchParams.set("maxResults", String(maxResults));
    searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const searchResponse = await fetch(searchUrl.toString());
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("YouTube API error:", errorText);
      throw new Error(`YouTube API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",");

    // Get video details for duration
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("part", "contentDetails,snippet");
    detailsUrl.searchParams.set("id", videoIds);
    detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = await detailsResponse.json();

    // Parse ISO 8601 duration to readable format
    const parseDuration = (isoDuration: string): string => {
      const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return "0:00";
      
      const hours = match[1] ? parseInt(match[1]) : 0;
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const seconds = match[3] ? parseInt(match[3]) : 0;
      
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      }
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    // Extract artist from title (common patterns)
    const extractArtist = (title: string): { artist: string; cleanTitle: string } => {
      // Try common patterns: "Artist - Song", "Artist | Song", "Song by Artist"
      const patterns = [
        /^(.+?)\s*[-–—]\s*(.+)$/,
        /^(.+?)\s*\|\s*(.+)$/,
        /^(.+?)\s*:\s*(.+)$/,
      ];
      
      for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
          return { artist: match[1].trim(), cleanTitle: match[2].trim() };
        }
      }
      
      return { artist: "Unknown Artist", cleanTitle: title };
    };

    const results = detailsData.items.map((item: any) => {
      const { artist, cleanTitle } = extractArtist(item.snippet.title);
      
      return {
        id: item.id,
        videoId: item.id,
        title: cleanTitle,
        artist: item.snippet.channelTitle || artist,
        thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
        duration: parseDuration(item.contentDetails.duration),
      };
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
