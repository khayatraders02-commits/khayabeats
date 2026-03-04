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

interface DownloadProgress {
  [videoId: string]: number;
}

export const useDownload = () => {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState<DownloadProgress>({});
  const [downloadedTracks, setDownloadedTracks] = useState<Track[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const loadedRef = useRef(false);

  // Load downloaded tracks on mount
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

    // Check if already downloaded
    const alreadyDownloaded = await isTrackDownloaded(track.videoId);
    if (alreadyDownloaded) {
      toast.info('Song already downloaded');
      return true;
    }

    // Check if already downloading
    if (downloading[track.videoId] !== undefined) {
      toast.info('Download already in progress');
      return false;
    }

    try {
      setDownloading(prev => ({ ...prev, [track.videoId]: 0 }));
      
      const toastId = silent ? null : toast.loading(`Downloading "${track.title}"...`);

      // Use local server offline endpoint directly
      const audioUrl = `http://localhost:3001/offline/download/${track.videoId}`;


      // Download and save to IndexedDB with progress
      const success = await saveToIndexedDB(
        track,
        audioUrl,
        (progress) => {
          setDownloading(prev => ({ ...prev, [track.videoId]: progress }));
        }
      );

      if (toastId) if (toastId) toast.dismiss(toastId);

      if (success) {
        // Save to database for sync across devices
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
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
