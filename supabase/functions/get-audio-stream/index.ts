import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

type AudioResult = { url: string; mimeType: string };
type RenderAuthStatus = {
  method?: string;
  status?: string;
  cookiesConfigured?: boolean;
  oauthConfigured?: boolean;
};

type RenderAttempt = {
  result: AudioResult | null;
  online: boolean;
  authStatus: RenderAuthStatus | null;
  error: string | null;
};

const DEFAULT_RENDER_URL = "https://khayabeats-3.onrender.com";

function getRenderBaseUrl() {
  return (Deno.env.get("KHAYABEATS_SERVER_URL") || DEFAULT_RENDER_URL).replace(/\/$/, "");
}

async function fetchJsonWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12000) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { response, data, text };
}

async function tryRenderServer(videoId: string): Promise<RenderAttempt> {
  const baseUrl = getRenderBaseUrl();

  try {
    const [health, auth] = await Promise.allSettled([
      fetchJsonWithTimeout(`${baseUrl}/health`, { headers: { Accept: "application/json" } }, 15000),
      fetchJsonWithTimeout(`${baseUrl}/auth-status`, { headers: { Accept: "application/json" } }, 8000),
    ]);

    const online = health.status === "fulfilled" && health.value.response.ok;

    const authStatus: RenderAuthStatus | null =
      auth.status === "fulfilled" && auth.value.response.ok && auth.value.data
        ? {
            method: auth.value.data.method,
            status: auth.value.data.status,
            cookiesConfigured: auth.value.data.cookiesConfigured,
            oauthConfigured: auth.value.data.oauthConfigured,
          }
        : null;

    if (!online) {
      return {
        result: null,
        online: false,
        authStatus,
        error: "Render server is offline or cold-starting too long",
      };
    }

    const audioReq = await fetchJsonWithTimeout(
      `${baseUrl}/audio-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ videoId }),
      },
      45000,
    );

    if (!audioReq.response.ok || !audioReq.data?.success || !audioReq.data?.audioUrl) {
      const authMissing =
        authStatus &&
        authStatus.status === "unauthenticated" &&
        !authStatus.cookiesConfigured &&
        !authStatus.oauthConfigured;

      return {
        result: null,
        online: true,
        authStatus,
        error: authMissing
          ? "Render server is online but not authenticated with YouTube"
          : audioReq.data?.error || `Render /audio-url failed (${audioReq.response.status})`,
      };
    }

    return {
      result: {
        url: audioReq.data.audioUrl,
        mimeType: "audio/mpeg",
      },
      online: true,
      authStatus,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      online: false,
      authStatus: null,
      error: error instanceof Error ? error.message : "Render server request failed",
    };
  }
}

async function tryPiped(videoId: string): Promise<AudioResult | null> {
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.private.coffee",
    "https://pipedapi.darkness.services",
    "https://watchapi.whatever.social",
  ];

  for (const instance of instances) {
    try {
      const r = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;

      const data = await r.json();
      if (data.error) continue;

      const streams = (data.audioStreams || []).filter((s: any) => s.url);
      if (streams.length === 0) continue;

      streams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      return { url: streams[0].url, mimeType: streams[0].mimeType || "audio/mp4" };
    } catch {
      // Try next instance
    }
  }

  return null;
}

async function tryInvidious(videoId: string): Promise<AudioResult | null> {
  const instances = [
    "https://yewtu.be",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
  ];

  for (const instance of instances) {
    try {
      const r = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;

      const data = await r.json();
      const audioFormats = (data.adaptiveFormats || []).filter((f: any) =>
        f.type?.includes("audio") && f.url,
      );
      if (audioFormats.length === 0) continue;

      audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      return {
        url: audioFormats[0].url,
        mimeType: audioFormats[0].type?.split(";")[0] || "audio/mp4",
      };
    } catch {
      // Try next instance
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);

    // Proxy mode for third-party URLs
    const proxyUrl = requestUrl.searchParams.get("proxy");
    if (proxyUrl) {
      const decodedUrl = decodeURIComponent(proxyUrl);
      const rangeHeader = req.headers.get("range");

      const headers: HeadersInit = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: "https://www.youtube.com/",
      };
      if (rangeHeader) headers["Range"] = rangeHeader;

      const audioResponse = await fetch(decodedUrl, {
        headers,
        signal: AbortSignal.timeout(30000),
      });

      if (!audioResponse.ok && audioResponse.status !== 206) {
        return new Response(
          JSON.stringify({ error: "Audio source unavailable", success: false }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const responseHeaders: HeadersInit = {
        ...corsHeaders,
        "Content-Type": audioResponse.headers.get("content-type") || "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=7200",
      };

      const contentLength = audioResponse.headers.get("content-length");
      const contentRange = audioResponse.headers.get("content-range");
      if (contentLength) responseHeaders["Content-Length"] = contentLength;
      if (contentRange) responseHeaders["Content-Range"] = contentRange;

      return new Response(audioResponse.body, {
        status: audioResponse.status,
        headers: responseHeaders,
      });
    }

    const body = await req.json();
    const { videoId } = body;

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "Video ID required", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Render production server first
    const renderAttempt = await tryRenderServer(videoId);
    if (renderAttempt.result) {
      return new Response(
        JSON.stringify({
          audioUrl: renderAttempt.result.url,
          mimeType: renderAttempt.result.mimeType,
          serverOnline: renderAttempt.online,
          source: "render",
          success: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Public source fallbacks (proxied)
    const publicResult = (await tryPiped(videoId)) || (await tryInvidious(videoId));
    if (publicResult) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const proxyEndpoint = `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(publicResult.url)}`;

      return new Response(
        JSON.stringify({
          audioUrl: proxyEndpoint,
          directUrl: publicResult.url,
          mimeType: publicResult.mimeType,
          serverOnline: renderAttempt.online,
          source: "public-fallback",
          success: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const unauthenticatedRender =
      renderAttempt.authStatus?.status === "unauthenticated" &&
      !renderAttempt.authStatus?.cookiesConfigured &&
      !renderAttempt.authStatus?.oauthConfigured;

    const finalError = unauthenticatedRender
      ? "Render server is online but unauthenticated. In Settings → Server Management, upload cookies.txt or complete OAuth, then retry playback."
      : "All audio sources are unavailable right now. Render VPS is reachable, but extraction failed.";

    return new Response(
      JSON.stringify({
        error: finalError,
        serverOnline: renderAttempt.online,
        renderAuth: renderAttempt.authStatus,
        diagnostics: renderAttempt.error,
        success: false,
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to get audio",
        serverOnline: false,
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
