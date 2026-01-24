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
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/ft\.?|feat\.?|featuring/gi, '')
    .replace(/official\s*(video|audio|music\s*video|lyric\s*video)?/gi, '')
    .replace(/lyrics?/gi, '')
    .replace(/hd|4k|1080p|audio|video/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean artist name
function cleanArtist(artist: string): string {
  return artist
    .split(/[,&]|ft\.?|feat\.?|featuring|x\s|\/|;/i)[0]
    .replace(/vevo|official|music|topic/gi, '')
    .replace(/\s+-\s+topic$/i, '')
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artist, title, duration } = await req.json();

    if (!artist || !title) {
      throw new Error("Artist and title are required");
    }

    const cleanedTitle = cleanTitle(title);
    const cleanedArtist = cleanArtist(artist);
    const durationSeconds = parseDuration(duration);

    console.log(`Fetching lyrics for: "${cleanedArtist}" - "${cleanedTitle}" (duration: ${durationSeconds}s)`);

    // Try LRCLIB with multiple search strategies
    const searchStrategies = [
      // Strategy 1: Full search with duration
      () => {
        let url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanedTitle)}&artist_name=${encodeURIComponent(cleanedArtist)}`;
        if (durationSeconds) url += `&duration=${durationSeconds}`;
        return url;
      },
      // Strategy 2: Search without duration
      () => `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanedTitle)}&artist_name=${encodeURIComponent(cleanedArtist)}`,
      // Strategy 3: Generic query search
      () => `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanedArtist} ${cleanedTitle}`)}`,
    ];

    for (const getUrl of searchStrategies) {
      try {
        const url = getUrl();
        console.log(`Trying LRCLIB: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { "Accept": "application/json" },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) continue;
        
        const results = await response.json();
        
        if (!Array.isArray(results) || results.length === 0) continue;
        
        // Find best match
        const best = results.find((r: any) => r.syncedLyrics) || results[0];
        
        if (best.syncedLyrics) {
          const parsedLyrics = parseLRC(best.syncedLyrics);
          console.log(`Found ${parsedLyrics.length} synced lyrics lines from LRCLIB`);
          
          return new Response(
            JSON.stringify({ 
              lyrics: best.plainLyrics || parsedLyrics.map(l => l.text).join('\n'),
              syncedLyrics: parsedLyrics,
              synced: true,
              source: "lrclib",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (best.plainLyrics) {
          console.log("Found plain lyrics from LRCLIB");
          return new Response(
            JSON.stringify({ 
              lyrics: best.plainLyrics,
              syncedLyrics: null,
              synced: false,
              source: "lrclib",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.log("LRCLIB strategy failed:", e);
        continue;
      }
    }

    // Fallback to lyrics.ovh
    try {
      const lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanedArtist)}/${encodeURIComponent(cleanedTitle)}`;
      console.log(`Trying lyrics.ovh: ${lyricsUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch(lyricsUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.lyrics) {
          console.log("Found lyrics from lyrics.ovh");
          return new Response(
            JSON.stringify({ 
              lyrics: data.lyrics,
              syncedLyrics: null,
              synced: false,
              source: "lyrics.ovh",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (e) {
      console.log("lyrics.ovh error:", e);
    }

    console.log("No lyrics found from any source");
    return new Response(
      JSON.stringify({ 
        lyrics: null, 
        syncedLyrics: null,
        synced: false,
        message: "Lyrics not found for this track" 
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
