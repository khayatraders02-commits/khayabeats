import { useState, useEffect, useCallback } from 'react';

// Remote server URL (set after deploying to Render/Railway/etc.)
// Falls back to localhost for local development
const REMOTE_SERVER_URL = import.meta.env.VITE_KHAYABEATS_SERVER_URL || 'https://khayabeats-3.onrender.com';
const LOCAL_SERVER_URL = 'http://localhost:3001';

const getServerUrl = () => {
  // If a remote URL is configured, always prefer it
  if (REMOTE_SERVER_URL) return REMOTE_SERVER_URL;
  // Otherwise fall back to local
  return LOCAL_SERVER_URL;
};

const canReachServer = () => {
  const url = getServerUrl();
  // Remote URLs are always reachable
  if (url !== LOCAL_SERVER_URL) return true;
  // Local server only reachable from localhost/native
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  if (protocol === 'file:') return true;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return true;
  return false;
};

interface ServerStatus {
  isOnline: boolean;
  isChecking: boolean;
  serverUrl: string;
  lastChecked: Date | null;
  cacheStats: {
    totalFiles: number;
    totalSizeMB: number;
  } | null;
  isReachableFromClient: boolean;
  reason: string | null;
  statusLabel: string | null;
}

export const useServerStatus = () => {
  const serverUrl = getServerUrl();

  const [status, setStatus] = useState<ServerStatus>({
    isOnline: false,
    isChecking: true,
    serverUrl,
    lastChecked: null,
    cacheStats: null,
    isReachableFromClient: true,
    reason: null,
    statusLabel: null,
  });

  const checkServerHealth = useCallback(async () => {
    if (!canReachServer()) {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        isChecking: false,
        lastChecked: new Date(),
        cacheStats: null,
        isReachableFromClient: false,
        reason: 'Local server is only reachable when the app runs on your own device.',
        statusLabel: 'Local only',
      }));
      return false;
    }

    setStatus((prev) => ({ ...prev, isChecking: true, isReachableFromClient: true, reason: null }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${serverUrl}/health`, {
        signal: controller.signal,
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const bodyText = await response.text();

      if (!response.ok) {
        const suspended = bodyText.includes('Service Suspended');
        setStatus((prev) => ({
          ...prev,
          isOnline: false,
          isChecking: false,
          lastChecked: new Date(),
          cacheStats: null,
          isReachableFromClient: true,
          reason: suspended ? 'Your Render music service is suspended.' : `Health check failed with status ${response.status}.`,
          statusLabel: suspended ? 'Suspended' : 'Offline',
        }));
        return false;
      }

      if (!contentType.includes('application/json')) {
        setStatus((prev) => ({
          ...prev,
          isOnline: false,
          isChecking: false,
          lastChecked: new Date(),
          cacheStats: null,
          isReachableFromClient: true,
          reason: 'Server returned a non-JSON health response.',
          statusLabel: 'Invalid health',
        }));
        return false;
      }

      const data = JSON.parse(bodyText);
      setStatus({
        isOnline: true,
        isChecking: false,
        serverUrl,
        lastChecked: new Date(),
        cacheStats: data.cache || null,
        isReachableFromClient: true,
        reason: null,
        statusLabel: 'Online',
      });
      return true;
    } catch {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        isChecking: false,
        lastChecked: new Date(),
        cacheStats: null,
        isReachableFromClient: true,
        reason: 'Server could not be reached from the client.',
        statusLabel: 'Offline',
      }));
      return false;
    }
  }, [serverUrl]);

  useEffect(() => {
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 30000);
    return () => clearInterval(interval);
  }, [checkServerHealth]);

  return {
    ...status,
    checkServerHealth,
    getStreamUrl: (videoId: string) => `${serverUrl}/stream/${videoId}`,
    getAudioUrlEndpoint: () => `${serverUrl}/audio-url`,
  };
};

// Export for use elsewhere
export const SERVER_URL = getServerUrl();
