import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Music server status, checked through the cloud function so the app never
 * needs the home PC address or its private key.
 */
export interface ServerStatus {
  isOnline: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  cacheStats: { totalFiles: number; totalSizeMB: number } | null;
  isReachableFromClient: boolean;
  reason: string | null;
  statusLabel: string | null;
  selfTestOk: boolean | null;
  youtubeAuth: string | null;
  setupComplete: boolean;
}

const initialStatus: ServerStatus = {
  isOnline: false,
  isChecking: true,
  lastChecked: null,
  cacheStats: null,
  isReachableFromClient: true,
  reason: null,
  statusLabel: null,
  selfTestOk: null,
  youtubeAuth: null,
  setupComplete: false,
};

export const useServerStatus = () => {
  const [status, setStatus] = useState<ServerStatus>(initialStatus);

  const checkServerHealth = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isChecking: true }));
    try {
      const { data, error } = await supabase.functions.invoke('get-audio-stream', {
        body: { action: 'status' },
      });
      if (error) throw error;

      const setupComplete = Boolean(data?.serverUrlConfigured && data?.cloudKeyConfigured);
      const online = Boolean(data?.online);
      const keyMatches = online && Boolean(data?.keyConfigured);

      let reason: string | null = null;
      let label = 'Online';
      if (!data?.serverUrlConfigured) {
        reason = 'The home PC music server has not been connected yet.';
        label = 'Not set up';
      } else if (!online) {
        reason = 'The home PC is off, asleep, or the music server is not running.';
        label = 'Offline';
      } else if (!keyMatches || !data?.cloudKeyConfigured) {
        reason = 'The home PC is online, but its server key does not match the app.';
        label = 'Key missing';
      } else if (data?.selfTest === false || data?.selfTestOk === false) {
        reason = 'The home PC is online, but YouTube blocked its last test.';
        label = 'Blocked';
      }

      setStatus({
        isOnline: online && keyMatches && Boolean(data?.cloudKeyConfigured),
        isChecking: false,
        lastChecked: new Date(),
        cacheStats: data?.cache || null,
        isReachableFromClient: true,
        reason,
        statusLabel: label,
        selfTestOk: data?.selfTestOk ?? null,
        youtubeAuth: data?.youtubeAuth ?? null,
        setupComplete,
      });
      return online;
    } catch {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        isChecking: false,
        lastChecked: new Date(),
        reason: 'Could not check the music server.',
        statusLabel: 'Unknown',
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 60000);
    return () => clearInterval(interval);
  }, [checkServerHealth]);

  return { ...status, checkServerHealth };
};
