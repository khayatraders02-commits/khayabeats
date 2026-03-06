import { useState, useCallback, useEffect, useRef } from 'react';
import { Track } from '@/types/music';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  downloadTrack as saveToIndexedDB,
  isTrackDownloaded,
  deleteDownloadedTrack,
  getAllDownloadedTracks,
  getStorageUsage,
} from '@/lib/offlineStorage';

const LOCAL_SERVER_URL = 'http://localhost:3001';

interface DownloadProgress {
  [videoId: string]: number;
}

const canUseLocalServerFromCurrentClient = () => {
  if (typeof window === 'undefined') return true;

  const host = window.location.hostname;
  const protocol = window.location.protocol;

  if (protocol === 'file:') return true;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
};

// Check if local server is reachable
const isLocalServerOnline = async (): Promise<boolean> => {
  if (!canUseLocalServerFromCurrentClient()) return false;

  try {
    const res = await fetch(`${LOCAL_SERVER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
};

export const useDownload = () => {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState<DownloadProgress>({});
  const [downloadedTracks, setDownloadedTracks] = useState<Track[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadDownloadedTracks();
    }
  }, []);

  const loadDownloadedTracks = useCallback(async () => {
    try {
      const tracks = await getAllDownloadedTracks();
      setDownloadedTracks(tracks);
      const storage = await getStorageUsage();
      setStorageUsed(storage.used);
    } catch (e) {
      console.error('Failed to load downloads:', e);
    }
  }, []);

  const checkIsDownloaded = useCallback(async (videoId: string): Promise<boolean> => {
    return isTrackDownloaded(videoId);
  }, []);

  const downloadTrack = useCallback(async (track: Track, silent = false): Promise<boolean> => {
    if (!user) {
      if (!silent) toast.error('Sign in to download songs');
      return false;
    }

    const alreadyDownloaded = await isTrackDownloaded(track.videoId);
    if (alreadyDownloaded) {
      if (!silent) toast.info('Song already downloaded');
      return true;
    }

    if (downloading[track.videoId] !== undefined) {
      if (!silent) toast.info('Download already in progress');
      return false;
    }

    try {
      setDownloading(prev => ({ ...prev, [track.videoId]: 0 }));
      const toastId = silent ? null : toast.loading(`Downloading "${track.title}"...`);

      let audioUrl: string;

      // Try local server first
      const serverOnline = await isLocalServerOnline();
      if (serverOnline) {
        audioUrl = `${LOCAL_SERVER_URL}/offline/download/${track.videoId}`;
      } else {
        // Fallback: get audio URL from edge function then download the audio
        const { data, error } = await supabase.functions.invoke('get-audio-stream', {
          body: {
            videoId: track.videoId,
            title: track.title,
            artist: track.artist,
          },
        });

        if (error || !data?.success || !data?.audioUrl) {
          throw new Error('Could not get audio source for download');
        }

        audioUrl = data.audioUrl;
      }

      const success = await saveToIndexedDB(
        track,
        audioUrl,
        (progress) => {
          setDownloading(prev => ({ ...prev, [track.videoId]: progress }));
        }
      );

      if (toastId) toast.dismiss(toastId);

      if (success) {
        try {
          await supabase.from('downloads').upsert({
            user_id: user.id,
            video_id: track.videoId,
            title: track.title,
            artist: track.artist,
            thumbnail_url: track.thumbnailUrl,
            duration: track.duration,
          }, { onConflict: 'user_id,video_id' });
        } catch (dbErr) {
          console.log('DB sync failed (non-critical):', dbErr);
        }

        await loadDownloadedTracks();
        if (!silent) toast.success(`"${track.title}" downloaded!`);
        return true;
      } else {
        throw new Error('Failed to save to device');
      }
    } catch (error) {
      console.error('Download error:', error);
      if (!silent) toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setDownloading(prev => {
        const next = { ...prev };
        delete next[track.videoId];
        return next;
      });
    }
  }, [user, downloading, loadDownloadedTracks]);

  const removeDownload = useCallback(async (videoId: string): Promise<boolean> => {
    try {
      const success = await deleteDownloadedTrack(videoId);

      if (success && user) {
        await supabase
          .from('downloads')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);
      }

      await loadDownloadedTracks();
      toast.success('Removed from downloads');
      return true;
    } catch (error) {
      console.error('Remove download error:', error);
      toast.error('Failed to remove download');
      return false;
    }
  }, [user, loadDownloadedTracks]);

  const getDownloadProgress = useCallback((videoId: string): number | null => {
    return downloading[videoId] ?? null;
  }, [downloading]);

  const isDownloading = useCallback((videoId: string): boolean => {
    return videoId in downloading;
  }, [downloading]);

  return {
    downloadTrack,
    removeDownload,
    checkIsDownloaded,
    getDownloadProgress,
    isDownloading,
    downloadedTracks,
    storageUsed,
    refreshDownloads: loadDownloadedTracks,
  };
};
