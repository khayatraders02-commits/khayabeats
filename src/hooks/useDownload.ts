import { useState, useCallback, useEffect } from 'react';
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

  // Load downloaded tracks on mount
  useEffect(() => {
    loadDownloadedTracks();
  }, []);

  const loadDownloadedTracks = async () => {
    const tracks = await getAllDownloadedTracks();
    setDownloadedTracks(tracks);
    const storage = await getStorageUsage();
    setStorageUsed(storage.used);
  };

  const checkIsDownloaded = useCallback(async (videoId: string): Promise<boolean> => {
    return isTrackDownloaded(videoId);
  }, []);

  const downloadTrack = useCallback(async (track: Track): Promise<boolean> => {
    if (!user) {
      toast.error('Sign in to download songs');
      return false;
    }

    // Check if already downloaded
    const alreadyDownloaded = await isTrackDownloaded(track.videoId);
    if (alreadyDownloaded) {
      toast.info('Song already downloaded');
      return true;
    }

    try {
      setDownloading(prev => ({ ...prev, [track.videoId]: 0 }));

      // Get audio URL from edge function
      const { data, error } = await supabase.functions.invoke('get-audio-stream', {
        body: { videoId: track.videoId },
      });

      if (error || !data.success || !data.audioUrl) {
        throw new Error(data?.error || 'Could not get audio stream');
      }

      // Download and save to IndexedDB
      const success = await saveToIndexedDB(
        track,
        data.audioUrl,
        (progress) => {
          setDownloading(prev => ({ ...prev, [track.videoId]: progress }));
        }
      );

      if (success) {
        // Save to database for sync across devices
        await supabase.from('downloads').insert({
          user_id: user.id,
          video_id: track.videoId,
          title: track.title,
          artist: track.artist,
          thumbnail_url: track.thumbnailUrl,
          duration: track.duration,
        });

        await loadDownloadedTracks();
        toast.success('Downloaded for offline listening');
        return true;
      } else {
        throw new Error('Failed to save to device');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed. Try again.');
      return false;
    } finally {
      setDownloading(prev => {
        const next = { ...prev };
        delete next[track.videoId];
        return next;
      });
    }
  }, [user]);

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
  }, [user]);

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
