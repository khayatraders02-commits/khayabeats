import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

// ── Source 1: YouTube Innertube API (direct, no third-party) ──
async function tryInnertube(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Try multiple client types — Android and iOS tend to work best
  const clients = [
    {
      name: "ANDROID_MUSIC",
      context: {
        client: {
          clientName: "ANDROID_MUSIC",
          clientVersion: "7.27.52",
          androidSdkVersion: 30,
          userAgent: "com.google.android.apps.youtube.music/7.27.52 (Linux; U; Android 11) gzip",
          hl: "en",
          gl: "US",
        },
      },
      userAgent: "com.google.android.apps.youtube.music/7.27.52 (Linux; U; Android 11) gzip",
      apiKey: "AIzaSyAOghZGza2MQSZkY_zfZ370N-PUdXEo8AI",
    },
    {
      name: "ANDROID",
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "19.29.37",
          androidSdkVersion: 30,
          userAgent: "com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip",
          hl: "en",
          gl: "US",
        },
      },
      userAgent: "com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip",
      apiKey: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
    },
    {
      name: "IOS",
      context: {
        client: {
          clientName: "IOS",
          clientVersion: "19.29.1",
          deviceMake: "Apple",
          deviceModel: "iPhone16,2",
          userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
          hl: "en",
          gl: "US",
        },
      },
      userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
      apiKey: "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
    },
    {
      name: "TV_EMBEDDED",
      context: {
        client: {
          clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
          clientVersion: "2.0",
          hl: "en",
          gl: "US",
        },
        thirdParty: {
          embedUrl: "https://www.google.com",
        },
      },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
      apiKey: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
    },
  ];

  for (const client of clients) {
    try {
      console.log(`[Innertube] Trying ${client.name}...`);

      const payload = {
        videoId,
        context: client.context,
        contentCheckOk: true,
        racyCheckOk: true,
        playbackContext: {
          contentPlaybackContext: {
            signatureTimestamp: 20073,
          },
        },
      };

      const r = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${client.apiKey}&prettyPrint=false`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": client.userAgent,
            "X-Youtube-Client-Name": "3",
            "X-Youtube-Client-Version": client.context.client.clientVersion,
            "Origin": "https://www.youtube.com",
            "Referer": "https://www.youtube.com/",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!r.ok) {
        console.log(`[Innertube] ${client.name}: HTTP ${r.status}`);
        continue;
      }

      const data = await r.json();

      if (data.playabilityStatus?.status !== "OK") {
        const reason = data.playabilityStatus?.reason || data.playabilityStatus?.status || "unknown";
        console.log(`[Innertube] ${client.name}: Not playable - ${reason}`);
        continue;
      }

      // Get audio streams from adaptiveFormats
      const formats = data.streamingData?.adaptiveFormats || [];
      const audioFormats = formats.filter((f: any) =>
        f.mimeType?.startsWith("audio/") && (f.url || f.signatureCipher)
      );

      if (audioFormats.length === 0) {
        console.log(`[Innertube] ${client.name}: No audio formats found`);
        continue;
      }

      // Sort by bitrate (highest first) and prefer formats with direct URLs
      audioFormats.sort((a: any, b: any) => {
        // Prefer direct URLs over signatureCipher
        if (a.url && !b.url) return -1;
        if (!a.url && b.url) return 1;
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

      // Only use formats with direct URLs (signatureCipher requires JS execution)
      const directFormats = audioFormats.filter((f: any) => f.url);

      if (directFormats.length === 0) {
        console.log(`[Innertube] ${client.name}: All formats require signature decryption`);
        continue;
      }

      const best = directFormats[0];
      const mime = best.mimeType?.split(";")[0] || "audio/mp4";
      console.log(`✓ [Innertube] ${client.name}: Got audio (${mime}, ${best.bitrate}bps)`);
      return { url: best.url, mimeType: mime };
    } catch (e) {
      console.log(`[Innertube] ${client.name}: ${(e as Error).message}`);
    }
  }
  return null;
}

// ── Source 2: Piped (YouTube proxy) ──
async function tryPiped(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.private.coffee",
    "https://pipedapi.leptons.xyz",
    "https://watchapi.whatever.social",
    "https://pipedapi.darkness.services",
  ];

  for (const instance of instances) {
    try {
      console.log(`[Piped] Trying: ${instance}`);
      const r = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "Accept": "application/json" },
      });
      if (!r.ok) { console.log(`[Piped] ${instance}: HTTP ${r.status}`); continue; }
      const data = await r.json();
      if (data.error) { console.log(`[Piped] ${instance}: ${data.error}`); continue; }
      const streams = (data.audioStreams || []).filter((s: any) => s.url);
      if (streams.length === 0) continue;
      streams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      console.log(`✓ [Piped] Success from ${instance}`);
      return { url: streams[0].url, mimeType: streams[0].mimeType || "audio/mp4" };
    } catch (e) {
      console.log(`[Piped] ${instance}: ${(e as Error).message}`);
    }
  }
  return null;
}

// ── Source 3: Invidious ──
async function tryInvidious(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const instances = [
    "https://yewtu.be",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.perennialte.ch",
  ];

  for (const instance of instances) {
    try {
      console.log(`[Invidious] Trying: ${instance}`);
      const r = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "Accept": "application/json" },
      });
      if (!r.ok) { console.log(`[Invidious] ${instance}: HTTP ${r.status}`); continue; }
      const data = await r.json();
      const audioFormats = (data.adaptiveFormats || []).filter((f: any) =>
        f.type?.includes('audio') && f.url
      );
      if (audioFormats.length === 0) continue;
      audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      console.log(`✓ [Invidious] Success from ${instance}`);
      return { url: audioFormats[0].url, mimeType: audioFormats[0].type?.split(';')[0] || "audio/mp4" };
    } catch (e) {
      console.log(`[Invidious] ${instance}: ${(e as Error).message}`);
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ── PROXY MODE ──
    const proxyUrl = url.searchParams.get("proxy");
    if (proxyUrl) {
      const decodedUrl = decodeURIComponent(proxyUrl);
      const rangeHeader = req.headers.get("range");
      const headers: HeadersInit = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://www.youtube.com/",
      };
      if (rangeHeader) headers["Range"] = rangeHeader;

      const audioResponse = await fetch(decodedUrl, { headers, signal: AbortSignal.timeout(30000) });
      if (!audioResponse.ok && audioResponse.status !== 206) {
        return new Response(
          JSON.stringify({ error: "Audio source unavailable", success: false }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const responseHeaders: HeadersInit = {
        ...corsHeaders,
        "Content-Type": audioResponse.headers.get("content-type") || "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=7200",
      };
      const cl = audioResponse.headers.get("content-length");
      const cr = audioResponse.headers.get("content-range");
      if (cl) responseHeaders["Content-Length"] = cl;
      if (cr) responseHeaders["Content-Range"] = cr;

      return new Response(audioResponse.body, { status: audioResponse.status, headers: responseHeaders });
    }

    // ── MAIN REQUEST ──
    const body = await req.json();
    const { videoId, title, artist } = body;

    if (!videoId && !title) {
      return new Response(
        JSON.stringify({ error: "Video ID or title required", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`\n===== Audio Request =====`);
    console.log(`Title: ${title} | Artist: ${artist} | VideoID: ${videoId}`);

    let result: { url: string; mimeType: string } | null = null;

    // 1. YouTube Innertube API (direct, most reliable)
    if (videoId) {
      console.log(`[1/3] Innertube...`);
      result = await tryInnertube(videoId);
    }

    // 2. Piped
    if (!result && videoId) {
      console.log(`[2/3] Piped...`);
      result = await tryPiped(videoId);
    }

    // 3. Invidious
    if (!result && videoId) {
      console.log(`[3/3] Invidious...`);
      result = await tryInvidious(videoId);
    }

    if (!result) {
      console.error("❌ All sources failed");
      return new Response(
        JSON.stringify({
          error: "Could not find an audio source for this track. Please try again later.",
          serverOnline: false,
          success: false,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const isLocalUrl = result.url.includes("localhost") || result.url.includes("127.0.0.1");
    const proxyEndpoint = isLocalUrl
      ? result.url
      : `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(result.url)}`;

    console.log(`✅ Audio ready!`);

    return new Response(
      JSON.stringify({
        audioUrl: proxyEndpoint,
        directUrl: result.url,
        mimeType: result.mimeType,
        serverOnline: true,
        success: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to get audio",
        serverOnline: false,
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
