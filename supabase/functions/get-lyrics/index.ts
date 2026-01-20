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
    const { artist, title } = await req.json();

    if (!artist || !title) {
      throw new Error("Artist and title are required");
    }

    // Use lyrics.ovh API (free, no key required)
    const lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    
    const response = await fetch(lyricsUrl);
    
    if (!response.ok) {
      // Try alternative search with simplified title
      const simplifiedTitle = title.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
      const altUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(simplifiedTitle)}`;
      
      const altResponse = await fetch(altUrl);
      
      if (!altResponse.ok) {
        return new Response(
          JSON.stringify({ lyrics: null, message: "Lyrics not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const altData = await altResponse.json();
      return new Response(
        JSON.stringify({ lyrics: altData.lyrics }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ lyrics: data.lyrics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Lyrics error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", lyrics: null }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
