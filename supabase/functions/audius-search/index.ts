import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Audius Discovery Nodes
const AUDIUS_NODES = [
  "https://discoveryprovider.audius.co",
  "https://discoveryprovider2.audius.co",
  "https://discoveryprovider3.audius.co",
  "https://dn1.monophonic.digital",
];

async function getWorkingNode(): Promise<string> {
  for (const node of AUDIUS_NODES) {
    try {
      const response = await fetch(`${node}/health_check`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) return node;
    } catch {
      continue;
    }
  }
  return AUDIUS_NODES[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 20, genre, mood } = await req.json();

    if (!query) {
      throw new Error("Search query is required");
    }

    const node = await getWorkingNode();
    console.log(`Searching Audius for: "${query}"`);

    // Search tracks
    let searchUrl = `${node}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=KHAYABEATS`;
    
    if (genre) {
      searchUrl += `&genre=${encodeURIComponent(genre)}`;
    }

    const response = await fetch(searchUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Audius API error: ${response.status}`);
    }

    const data = await response.json();
    const tracks = data.data || [];

    // Transform to our Track format
    const results = tracks.map((track: any) => ({
      id: `audius_${track.id}`,
      videoId: `audius_${track.id}`,
      title: track.title,
      artist: track.user?.name || "Unknown Artist",
      duration: formatDuration(track.duration),
      thumbnail: track.artwork?.["480x480"] || track.artwork?.["150x150"] || "/placeholder.svg",
      isAudius: true,
      audiusId: track.id,
      genre: track.genre,
      mood: track.mood,
      playCount: track.play_count,
      favoriteCount: track.favorite_count,
      artistHandle: track.user?.handle,
      artistImage: track.user?.profile_picture?.["480x480"],
    }));

    console.log(`Found ${results.length} tracks on Audius`);

    return new Response(
      JSON.stringify({ results, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Audius search error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Search failed",
        results: [],
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
