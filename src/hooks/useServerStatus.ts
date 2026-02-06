import { useState, useEffect, useCallback } from 'react';

// Default server URL - runs on user's local PC
const DEFAULT_SERVER_URL = 'http://localhost:3001';

interface ServerStatus {
  isOnline: boolean;
  isChecking: boolean;
  serverUrl: string;
  lastChecked: Date | null;
  cacheStats: {
    totalFiles: number;
    totalSizeMB: number;
  } | null;
}

export const useServerStatus = () => {
  const [status, setStatus] = useState<ServerStatus>({
    isOnline: false,
    isChecking: true,
    serverUrl: DEFAULT_SERVER_URL,
    lastChecked: null,
    cacheStats: null,
  });

  const checkServerHealth = useCallback(async () => {
    setStatus(prev => ({ ...prev, isChecking: true }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${DEFAULT_SERVER_URL}/health`, {
        signal: controller.signal,
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setStatus({
          isOnline: true,
          isChecking: false,
          serverUrl: DEFAULT_SERVER_URL,
          lastChecked: new Date(),
          cacheStats: data.cache || null,
        });
        return true;
      } else {
        throw new Error('Server not healthy');
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        isChecking: false,
        lastChecked: new Date(),
        cacheStats: null,
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
