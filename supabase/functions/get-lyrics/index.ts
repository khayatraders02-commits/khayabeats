import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LRCLine {
  time: number;
  text: string;
}

// Parse LRC format into time-synced lines
function parseLRC(lrc: string): LRCLine[] {
  const lines = lrc.split("\n");
  const parsed: LRCLine[] = [];
  
  for (const line of lines) {
    // Match patterns like [00:18.90]Text or [01:22.40]Text
    const match = line.match(/\[(\d+):(\d+\.?\d*)\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const text = match[3].trim();
      
      if (text) {
        parsed.push({
          time: minutes * 60 + seconds,
          text,
        });
      }
    }
  }
  
  return parsed.sort((a, b) => a.time - b.time);
}

// Clean up title for better matching
function cleanTitle(title: string): string {
  return title
    // Remove common video suffixes
    .replace(/\(official\s*(music\s*)?video\)/gi, '')
    .replace(/\(official\s*audio\)/gi, '')
    .replace(/\(audio\)/gi, '')
    .replace(/\(lyric\s*video\)/gi, '')
    .replace(/\(lyrics?\)/gi, '')
    .replace(/\(visualizer\)/gi, '')
    .replace(/\(official\)/gi, '')
    // Remove bracketed content
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    // Remove common tags
    .replace(/official\s*(video|audio|music\s*video|lyric\s*video)?/gi, '')
    .replace(/lyrics?/gi, '')
    .replace(/hd|hq|4k|1080p|audio|video/gi, '')
    .replace(/ft\.?|feat\.?|featuring/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean artist name
function cleanArtist(artist: string): string {
  return artist
    .split(/[,&]|ft\.?|feat\.?|featuring|x\s|\/|;/i)[0]
    .replace(/vevo|official|music|topic/gi, '')
    .replace(/\s+-\s+topic$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse duration string to seconds
function parseDuration(duration?: string): number | null {
  if (!duration) return null;
  const parts = duration.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

// LRCLIB API - primary source for synced lyrics
async function searchLRCLIB(artist: string, title: string, durationSeconds: number | null): Promise<{ lyrics: string | null; syncedLyrics: LRCLine[] | null; synced: boolean } | null> {
  const searchStrategies = [
    // Strategy 1: Exact match with duration
    () => {
      let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
      if (durationSeconds) url += `&duration=${durationSeconds}`;
      return { url, method: 'GET' };
    },
    // Strategy 2: Search without duration
    () => ({
      url: `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      method: 'GET'
    }),
    // Strategy 3: Search API with artist + title
    () => ({
      url: `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
      method: 'GET'
    }),
    // Strategy 4: Generic query search  
    () => ({
      url: `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`,
      method: 'GET'
    }),
  ];

  for (const getConfig of searchStrategies) {
    try {
      const config = getConfig();
      console.log(`Trying LRCLIB: ${config.url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(config.url, {
        method: config.method,
        signal: controller.signal,
        headers: { 
          "Accept": "application/json",
          "User-Agent": "KhayaBeats/1.0",
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) continue;
        continue;
      }
      
      const data = await response.json();
      
      // Handle array response from search
      let result = data;
      if (Array.isArray(data)) {
        if (data.length === 0) continue;
        // Find best match - prefer synced lyrics
        result = data.find((r: any) => r.syncedLyrics) || data[0];
      }
      
      if (result.syncedLyrics) {
        const parsedLyrics = parseLRC(result.syncedLyrics);
        if (parsedLyrics.length > 0) {
          console.log(`Found ${parsedLyrics.length} synced lyrics lines from LRCLIB`);
          return {
            lyrics: result.plainLyrics || parsedLyrics.map(l => l.text).join('\n'),
            syncedLyrics: parsedLyrics,
            synced: true,
          };
        }
      }
      
      if (result.plainLyrics) {
        console.log("Found plain lyrics from LRCLIB");
        return {
          lyrics: result.plainLyrics,
          syncedLyrics: null,
          synced: false,
        };
      }
    } catch (e) {
      console.log("LRCLIB strategy failed:", e);
      continue;
    }
  }
  
  return null;
}

// Fallback: lyrics.ovh (plain lyrics only)
async function searchLyricsOVH(artist: string, title: string): Promise<string | null> {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    console.log(`Trying lyrics.ovh: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data.lyrics) {
        console.log("Found lyrics from lyrics.ovh");
        return data.lyrics;
      }
    }
  } catch (e) {
    console.log("lyrics.ovh error:", e);
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artist, title, duration } = await req.json();

    if (!title) {
      throw new Error("Title is required");
    }

    const cleanedTitle = cleanTitle(title);
    const cleanedArtist = cleanArtist(artist || 'Unknown');
    const durationSeconds = parseDuration(duration);

    console.log(`Fetching lyrics for: "${cleanedArtist}" - "${cleanedTitle}" (duration: ${durationSeconds}s)`);

    // Try LRCLIB first (best for synced lyrics)
    const lrclibResult = await searchLRCLIB(cleanedArtist, cleanedTitle, durationSeconds);
    
    if (lrclibResult) {
      return new Response(
        JSON.stringify({ 
          lyrics: lrclibResult.lyrics,
          syncedLyrics: lrclibResult.syncedLyrics,
          synced: lrclibResult.synced,
          source: "lrclib",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback to lyrics.ovh
    const plainLyrics = await searchLyricsOVH(cleanedArtist, cleanedTitle);
    
    if (plainLyrics) {
      return new Response(
        JSON.stringify({ 
          lyrics: plainLyrics,
          syncedLyrics: null,
          synced: false,
          source: "lyrics.ovh",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No lyrics found
    console.log("No lyrics found from any source");
    return new Response(
      JSON.stringify({ 
        lyrics: null, 
        syncedLyrics: null,
        synced: false,
        message: "Lyrics not available for this track" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Lyrics error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error", 
        lyrics: null,
        syncedLyrics: null,
        synced: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
