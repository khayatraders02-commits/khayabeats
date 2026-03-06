import { useState, useEffect, useCallback } from 'react';

// Default server URL - runs on user's local PC
const DEFAULT_SERVER_URL = 'http://localhost:3001';

const canUseLocalServerFromCurrentClient = () => {
  if (typeof window === 'undefined') return true;

  const host = window.location.hostname;
  const protocol = window.location.protocol;

  if (protocol === 'file:') return true;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return true;

  // Cloud previews cannot reach the user's localhost machine.
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
}

export const useServerStatus = () => {
  const [status, setStatus] = useState<ServerStatus>({
    isOnline: false,
    isChecking: true,
    serverUrl: DEFAULT_SERVER_URL,
    lastChecked: null,
    cacheStats: null,
    isReachableFromClient: true,
    reason: null,
  });

  const checkServerHealth = useCallback(async () => {
    if (!canUseLocalServerFromCurrentClient()) {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        isChecking: false,
        lastChecked: new Date(),
        cacheStats: null,
        isReachableFromClient: false,
        reason: 'Local server is only reachable when the app runs on your own device.',
      }));
      return false;
    }

    setStatus((prev) => ({ ...prev, isChecking: true, isReachableFromClient: true, reason: null }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${DEFAULT_SERVER_URL}/health`, {
        signal: controller.signal,
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Server not healthy');
      }

      const data = await response.json();
      setStatus({
        isOnline: true,
        isChecking: false,
        serverUrl: DEFAULT_SERVER_URL,
        lastChecked: new Date(),
        cacheStats: data.cache || null,
        isReachableFromClient: true,
        reason: null,
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
        reason: null,
      }));
      return false;
    }
  }, []);

  // Check on mount and periodically
  useEffect(() => {
    checkServerHealth();

    // Check every 30 seconds
    const interval = setInterval(checkServerHealth, 30000);

    return () => clearInterval(interval);
  }, [checkServerHealth]);

  return {
    ...status,
    checkServerHealth,
    getStreamUrl: (videoId: string) => `${DEFAULT_SERVER_URL}/stream/${videoId}`,
    getAudioUrlEndpoint: () => `${DEFAULT_SERVER_URL}/audio-url`,
  };
};

// Export for use in edge function
export const SERVER_URL = DEFAULT_SERVER_URL;
