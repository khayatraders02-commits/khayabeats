import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Extract artist from title
const extractArtist = (title: string, channelTitle: string): { artist: string; cleanTitle: string } => {
  // Common patterns: "Artist - Song", "Artist | Song"
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
  
  // Clean channel title as fallback
  const cleanChannel = channelTitle
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .trim();
  
  return { artist: cleanChannel || "Unknown Artist", cleanTitle: title };
};

// Filter out long videos (likely mixes/compilations) 
const isValidTrack = (duration: string): boolean => {
  const parts = duration.split(':').map(Number);
  let totalSeconds = 0;
  
  if (parts.length === 3) {
    totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    totalSeconds = parts[0] * 60 + parts[1];
  } else {
    return true;
  }
  
  // Filter out videos longer than 12 minutes (likely mixes/compilations)
  return totalSeconds > 30 && totalSeconds < 720;
};

// PRIMARY: YouTube Data API
async function searchYouTubeAPI(query: string, maxResults: number): Promise<any[]> {
  const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
  
  if (!YOUTUBE_API_KEY) {
    console.log("YouTube API key not configured");
    return [];
  }
  
  try {
    // Search for music videos
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", `${query} audio`);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("videoCategoryId", "10");
    searchUrl.searchParams.set("maxResults", String(Math.min(maxResults * 2, 50))); // Get extra to filter
    searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const searchResponse = await fetch(searchUrl.toString());
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("YouTube API error:", errorText);
      
      // Check for quota exceeded
      if (searchResponse.status === 403) {
        console.log("YouTube API quota exceeded, trying fallback...");
        return [];
      }
      return [];
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.items || searchData.items.length === 0) {
      return [];
    }
    
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",");

    // Get video details for duration
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("part", "contentDetails,snippet");
    detailsUrl.searchParams.set("id", videoIds);
    detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const detailsResponse = await fetch(detailsUrl.toString());
    
    if (!detailsResponse.ok) {
      return [];
    }
    
    const detailsData = await detailsResponse.json();

    const results = detailsData.items
      .map((item: any) => {
        const duration = parseDuration(item.contentDetails.duration);
        const { artist, cleanTitle } = extractArtist(item.snippet.title, item.snippet.channelTitle);
        
        return {
          id: item.id,
          videoId: item.id,
          title: cleanTitle,
          artist: artist,
          thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
          duration,
        };
      })
      .filter((track: any) => isValidTrack(track.duration))
      .slice(0, maxResults);

    console.log(`YouTube API returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error("YouTube API error:", error);
    return [];
  }
}

// FALLBACK: Piped API (no API key needed)
async function searchPipedAPI(query: string, maxResults: number): Promise<any[]> {
  const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://api.piped.private.coffee",
  ];
  
  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`Trying Piped search: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(
        `${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
        {
          signal: controller.signal,
          headers: { "Accept": "application/json" },
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) continue;
      
      const results = data.items
        .filter((item: any) => item.type === "stream" && item.duration > 30 && item.duration < 720)
        .slice(0, maxResults)
        .map((item: any) => {
          // Extract video ID from URL
          const urlMatch = item.url?.match(/\/watch\?v=([^&]+)/);
          const videoId = urlMatch ? urlMatch[1] : item.url?.replace('/watch?v=', '') || '';
          
          const { artist, cleanTitle } = extractArtist(item.title || '', item.uploaderName || '');
          
          const minutes = Math.floor((item.duration || 0) / 60);
          const seconds = (item.duration || 0) % 60;
          const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          
          return {
            id: videoId,
            videoId,
            title: cleanTitle || item.title,
            artist: artist || item.uploaderName || 'Unknown Artist',
            thumbnailUrl: item.thumbnail || '',
            duration,
          };
        });
      
      console.log(`Piped API returned ${results.length} results`);
      return results;
    } catch (e) {
      console.log(`Piped ${instance} failed:`, e);
      continue;
    }
  }
  
  return [];
}

// FALLBACK: Invidious API
async function searchInvidiousAPI(query: string, maxResults: number): Promise<any[]> {
  const INVIDIOUS_INSTANCES = [
    "https://invidious.fdn.fr",
    "https://vid.puffyan.us",
    "https://invidious.privacydev.net",
  ];
  
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying Invidious search: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        {
          signal: controller.signal,
          headers: { "Accept": "application/json" },
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) continue;
      
      const results = data
        .filter((item: any) => item.type === "video" && item.lengthSeconds > 30 && item.lengthSeconds < 720)
        .slice(0, maxResults)
        .map((item: any) => {
          const { artist, cleanTitle } = extractArtist(item.title || '', item.author || '');
          
          const minutes = Math.floor((item.lengthSeconds || 0) / 60);
          const seconds = (item.lengthSeconds || 0) % 60;
          const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          
          return {
            id: item.videoId,
            videoId: item.videoId,
            title: cleanTitle || item.title,
            artist: artist || item.author || 'Unknown Artist',
            thumbnailUrl: item.videoThumbnails?.[0]?.url || '',
            duration,
          };
        });
      
      console.log(`Invidious API returned ${results.length} results`);
      return results;
    } catch (e) {
      console.log(`Invidious ${instance} failed:`, e);
      continue;
    }
  }
  
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, maxResults = 20 } = await req.json();

    if (!query) {
      throw new Error("Search query is required");
    }

    console.log(`Searching for: "${query}"`);

    // Try YouTube API first
    let results = await searchYouTubeAPI(query, maxResults);
    
    // If YouTube fails or returns no results, try fallbacks
    if (results.length === 0) {
      console.log("YouTube API failed, trying Piped fallback...");
      results = await searchPipedAPI(query, maxResults);
    }
    
    if (results.length === 0) {
      console.log("Piped failed, trying Invidious fallback...");
      results = await searchInvidiousAPI(query, maxResults);
    }
    
    if (results.length === 0) {
      console.log("All search sources failed");
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Search failed",
        results: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
