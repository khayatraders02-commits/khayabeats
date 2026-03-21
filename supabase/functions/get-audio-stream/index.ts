import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

type AudioResult = { url: string; mimeType: string };
type ResolvedAudioResult = AudioResult & { provider: string };
type RenderAuthStatus = {
  method?: string;
  status?: string;
  cookiesConfigured?: boolean;
  oauthConfigured?: boolean;
};

type ProviderAttempt = {
  provider: string;
  category: "render" | "piped" | "invidious";
  success: boolean;
  status?: number;
  contentType?: string | null;
  error?: string;
  scoreBefore: number;
  scoreAfter: number;
};

type ProviderHealth = {
  score: number;
  successes: number;
  failures: number;
  lastError?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
};

type ProviderResolution = {
  result: ResolvedAudioResult | null;
  attempts: ProviderAttempt[];
};

type RenderAttempt = {
  result: ResolvedAudioResult | null;
  online: boolean;
  authStatus: RenderAuthStatus | null;
  error: string | null;
  attempts: ProviderAttempt[];
};

const DEFAULT_RENDER_URL = "https://khayabeats-3.onrender.com";
const INITIAL_PROVIDER_SCORE = 100;
const MIN_PROVIDER_SCORE = 0;
const MAX_PROVIDER_SCORE = 100;
const providerHealth = new Map<string, ProviderHealth>();

const PIPED_INSTANCES = [
  { name: "piped-kavin", url: "https://pipedapi.kavin.rocks" },
  { name: "piped-private-coffee", url: "https://api.piped.private.coffee" },
  { name: "piped-darkness", url: "https://pipedapi.darkness.services" },
  { name: "piped-whatever", url: "https://watchapi.whatever.social" },
];

const INVIDIOUS_INSTANCES = [
  { name: "invidious-yewtu", url: "https://yewtu.be" },
  { name: "invidious-nadeko", url: "https://inv.nadeko.net" },
  { name: "invidious-nerdvpn", url: "https://invidious.nerdvpn.de" },
];

function getRenderBaseUrl() {
  return (Deno.env.get("KHAYABEATS_SERVER_URL") || DEFAULT_RENDER_URL).replace(/\/$/, "");
}

function getProviderHealth(provider: string): ProviderHealth {
  const existing = providerHealth.get(provider);
  if (existing) return existing;

  const next = {
    score: INITIAL_PROVIDER_SCORE,
    successes: 0,
    failures: 0,
  } satisfies ProviderHealth;
  providerHealth.set(provider, next);
  return next;
}

function markProviderSuccess(provider: string) {
  const current = getProviderHealth(provider);
  const next: ProviderHealth = {
    ...current,
    score: Math.min(MAX_PROVIDER_SCORE, current.score + 8),
    successes: current.successes + 1,
    lastSuccessAt: new Date().toISOString(),
    lastError: undefined,
  };
  providerHealth.set(provider, next);
  return next.score;
}

function markProviderFailure(provider: string, error: string) {
  const current = getProviderHealth(provider);
  const next: ProviderHealth = {
    ...current,
    score: Math.max(MIN_PROVIDER_SCORE, current.score - 25),
    failures: current.failures + 1,
    lastFailureAt: new Date().toISOString(),
    lastError: error,
  };
  providerHealth.set(provider, next);
  return next.score;
}

function sortProvidersByHealth<T extends { name: string }>(providers: T[]) {
  return [...providers].sort((a, b) => getProviderHealth(b.name).score - getProviderHealth(a.name).score);
}

function isAudioLikeContentType(contentType: string | null) {
  if (!contentType) return true;
  const value = contentType.toLowerCase();
  return value.startsWith("audio/") || value.includes("application/octet-stream");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const msg = `${error.name} ${error.message}`.toLowerCase();
  return msg.includes("timeout") || msg.includes("timed out") || msg.includes("abort");
}

async function tryRenderServer(videoId: string): Promise<RenderAttempt> {
  const baseUrl = getRenderBaseUrl();
  const streamUrl = `${baseUrl}/stream/${videoId}`;
  const attempts: ProviderAttempt[] = [];
  const scoreBefore = getProviderHealth("render").score;

  // Quick health + auth check (parallel, short timeouts)
  const [health, auth] = await Promise.allSettled([
    fetchJsonWithTimeout(`${baseUrl}/health`, { headers: { Accept: "application/json" } }, 10000),
    fetchJsonWithTimeout(`${baseUrl}/auth-status`, { headers: { Accept: "application/json" } }, 6000),
  ]);

  const online = health.status === "fulfilled" && health.value.response.ok;
  const healthContentType = health.status === "fulfilled"
    ? health.value.response.headers.get("content-type")
    : null;

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
    const suspendedText = health.status === "fulfilled" ? (health.value.text || "") : "";
    const error = suspendedText.includes("Service Suspended")
      ? "Render service is suspended"
      : "Render server is offline or cold-starting";
    const scoreAfter = markProviderFailure("render", error);
    attempts.push({
      provider: "render",
      category: "render",
      success: false,
      status: health.status === "fulfilled" ? health.value.response.status : undefined,
      contentType: healthContentType,
      error,
      scoreBefore,
      scoreAfter,
    });

    return {
      result: null,
      online: false,
      authStatus,
      error,
      attempts,
    };
  }

  // Check if server is authenticated before sending stream URL
  const authMissing =
    authStatus &&
    authStatus.status === "unauthenticated" &&
    !authStatus.cookiesConfigured &&
    !authStatus.oauthConfigured;

  if (authMissing) {
    const scoreAfter = markProviderFailure("render", "Render server is online but not authenticated with YouTube");
    attempts.push({
      provider: "render",
      category: "render",
      success: false,
      status: 200,
      contentType: healthContentType,
      error: "Render server is online but not authenticated with YouTube",
      scoreBefore,
      scoreAfter,
    });

    return {
      result: null,
      online: true,
      authStatus,
      error: "Render server is online but not authenticated with YouTube",
      attempts,
    };
  }

  // Go directly to /stream endpoint — it downloads + streams on the fly
  // This avoids the slow /audio-url extraction that exceeds edge function time limits
  const scoreAfter = markProviderSuccess("render");
  attempts.push({
    provider: "render",
    category: "render",
    success: true,
    status: 200,
    contentType: "audio/mpeg",
    scoreBefore,
    scoreAfter,
  });

  return {
    result: {
      url: streamUrl,
      mimeType: "audio/mpeg",
      provider: "render",
    },
    online: true,
    authStatus,
    error: null,
    attempts,
  };
}

async function tryPiped(videoId: string): Promise<ProviderResolution> {
  const attempts: ProviderAttempt[] = [];

  for (const provider of sortProvidersByHealth(PIPED_INSTANCES)) {
    const scoreBefore = getProviderHealth(provider.name).score;

    try {
      const response = await fetch(`${provider.url}/streams/${videoId}`, {
        signal: AbortSignal.timeout(4500),
        headers: { Accept: "application/json" },
      });

      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        throw new Error(`${provider.name} ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(`${provider.name} ${data.error}`);

      const streams = (data.audioStreams || []).filter((s: any) => s.url);
      if (streams.length === 0) throw new Error(`${provider.name} no streams`);

      streams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      const scoreAfter = markProviderSuccess(provider.name);
      attempts.push({
        provider: provider.name,
        category: "piped",
        success: true,
        status: response.status,
        contentType,
        scoreBefore,
        scoreAfter,
      });

      return {
        result: {
          url: streams[0].url,
          mimeType: streams[0].mimeType || "audio/mp4",
          provider: provider.name,
        },
        attempts,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      const scoreAfter = markProviderFailure(provider.name, message);
      attempts.push({
        provider: provider.name,
        category: "piped",
        success: false,
        error: message,
        scoreBefore,
        scoreAfter,
      });
    }
  }

  return { result: null, attempts };
}

async function tryInvidious(videoId: string): Promise<ProviderResolution> {
  const attempts: ProviderAttempt[] = [];

  for (const provider of sortProvidersByHealth(INVIDIOUS_INSTANCES)) {
    const scoreBefore = getProviderHealth(provider.name).score;

    try {
      const response = await fetch(`${provider.url}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(4500),
        headers: { Accept: "application/json" },
      });

      const contentType = response.headers.get("content-type");
      if (!response.ok) throw new Error(`${provider.name} ${response.status}`);

      const data = await response.json();
      const audioFormats = (data.adaptiveFormats || []).filter((f: any) =>
        f.type?.includes("audio") && f.url,
      );
      if (audioFormats.length === 0) throw new Error(`${provider.name} no formats`);

      audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      const scoreAfter = markProviderSuccess(provider.name);
      attempts.push({
        provider: provider.name,
        category: "invidious",
        success: true,
        status: response.status,
        contentType,
        scoreBefore,
        scoreAfter,
      });

      return {
        result: {
          url: audioFormats[0].url,
          mimeType: audioFormats[0].type?.split(";")[0] || "audio/mp4",
          provider: provider.name,
        },
        attempts,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      const scoreAfter = markProviderFailure(provider.name, message);
      attempts.push({
        provider: provider.name,
        category: "invidious",
        success: false,
        error: message,
        scoreBefore,
        scoreAfter,
      });
    }
  }

  return { result: null, attempts };
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

      const contentType = audioResponse.headers.get("content-type");

      if (!audioResponse.ok && audioResponse.status !== 206) {
        const snippet = await audioResponse.text();
        return new Response(
          JSON.stringify({
            error: "Audio source unavailable",
            success: false,
            status: audioResponse.status,
            contentType,
            bodySnippet: snippet.slice(0, 500),
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!isAudioLikeContentType(contentType)) {
        const snippet = await audioResponse.text();
        return new Response(
          JSON.stringify({
            error: "Audio source returned a non-audio payload",
            success: false,
            status: audioResponse.status,
            contentType,
            bodySnippet: snippet.slice(0, 500),
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const responseHeaders: HeadersInit = {
        ...corsHeaders,
        "Content-Type": contentType || "audio/mpeg",
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

    // 1) Public source fallbacks first for cloud playback/downloads.
    // Render is still useful, but YouTube blocks datacenter IPs often enough that
    // returning /stream first causes the browser audio element to receive JSON error
    // payloads instead of playable audio bytes.
    const [pipedResolution, invidiousResolution, renderAttempt] = await Promise.all([
      tryPiped(videoId),
      tryInvidious(videoId),
      tryRenderServer(videoId),
    ]);

    const providerDiagnostics = [
      ...pipedResolution.attempts,
      ...invidiousResolution.attempts,
      ...renderAttempt.attempts,
    ];

    console.log(JSON.stringify({ videoId, providerDiagnostics }));

    const publicCandidates = [pipedResolution.result, invidiousResolution.result].filter(Boolean) as ResolvedAudioResult[];
    publicCandidates.sort((a, b) => getProviderHealth(b.provider).score - getProviderHealth(a.provider).score);
    const publicResult = publicCandidates[0];

    if (publicResult) {
      const proxyEndpoint = `${supabaseUrl}/functions/v1/get-audio-stream?proxy=${encodeURIComponent(publicResult.url)}`;

      return new Response(
        JSON.stringify({
          audioUrl: proxyEndpoint,
          directUrl: publicResult.url,
          mimeType: publicResult.mimeType,
          serverOnline: renderAttempt.online,
          source: publicResult.provider,
          providerDiagnostics,
          success: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Render last fallback only when public mirrors fail.
    if (renderAttempt.result) {
      return new Response(
        JSON.stringify({
          audioUrl: renderAttempt.result.url,
          mimeType: renderAttempt.result.mimeType,
          serverOnline: renderAttempt.online,
          source: renderAttempt.result.provider,
          providerDiagnostics,
          success: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const unauthenticatedRender =
      renderAttempt.authStatus?.status === "unauthenticated" &&
      !renderAttempt.authStatus?.cookiesConfigured &&
      !renderAttempt.authStatus?.oauthConfigured;

    const blockedRender =
      renderAttempt.online &&
      !unauthenticatedRender &&
      Boolean(renderAttempt.error || renderAttempt.authStatus?.cookiesConfigured || renderAttempt.authStatus?.oauthConfigured);

    const finalError = unauthenticatedRender
      ? "Render server is online but unauthenticated. In Settings → Server Management, upload cookies.txt or complete OAuth, then retry playback."
      : renderAttempt.error === "Render service is suspended"
        ? "Your Render music server is suspended, so playback and downloads cannot work until that service is restored."
      : blockedRender
        ? "Public mirrors failed and the Render VPS could not extract this track. This usually means YouTube is blocking the server IP, so playback/downloads cannot rely on Render for this song right now."
        : "All audio sources are unavailable right now.";

    return new Response(
      JSON.stringify({
        error: finalError,
        serverOnline: renderAttempt.online,
        renderAuth: renderAttempt.authStatus,
        diagnostics: renderAttempt.error,
        providerDiagnostics,
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
