import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Track } from '@/types/music';
import { isTrackDownloaded } from '@/lib/offlineStorage';
import { useDownload } from '@/hooks/useDownload';

const BACKUP_STORAGE_KEY = 'kb_last_backup_date';
const MAX_BACKUP_TRACKS = 30; // ~80% of top 40 tracks
const MAX_DAILY_DOWNLOADS = 10; // Limit per day to avoid overloading

/**
 * Automatically backs up ~80% of user's most played tracks in background.
 * Runs once per day silently.
 */
export const useAutoBackup = () => {
  const { user } = useAuth();
  const { downloadTrack } = useDownload();
  const runningRef = useRef(false);

  const shouldRunToday = useCallback((): boolean => {
    const lastRun = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!lastRun) return true;
    const lastDate = new Date(lastRun).toDateString();
    const today = new Date().toDateString();
    return lastDate !== today;
  }, []);

  const markDone = useCallback(() => {
    localStorage.setItem(BACKUP_STORAGE_KEY, new Date().toISOString());
  }, []);

  const runBackup = useCallback(async () => {
    if (!user || runningRef.current || !shouldRunToday()) return;
    runningRef.current = true;

    try {
      // Fetch recently played (frequency-based)
      const { data: recentData } = await supabase
        .from('recently_played')
        .select('*')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(100);

      // Fetch favorites
      const { data: favData } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .limit(50);

      // Score tracks by frequency + favorite status
      const scoreMap = new Map<string, { track: Track; score: number }>();

      (recentData || []).forEach((item, idx) => {
        const videoId = item.video_id;
        const existing = scoreMap.get(videoId);
        const track: Track = {
          id: item.id,
          videoId,
          title: item.title,
          artist: item.artist || 'Unknown',
          thumbnailUrl: item.thumbnail_url || '',
          duration: item.duration || '0:00',
        };
        if (existing) {
          existing.score += 10; // Each play adds 10 points
        } else {
          scoreMap.set(videoId, { track, score: 10 + Math.max(0, 50 - idx) });
        }
      });

      // Favorites get bonus
      (favData || []).forEach((item) => {
        const videoId = item.video_id;
        const existing = scoreMap.get(videoId);
        if (existing) {
          existing.score += 50;
        } else {
          scoreMap.set(videoId, {
            track: {
              id: item.id,
              videoId,
              title: item.title,
              artist: item.artist || 'Unknown',
              thumbnailUrl: item.thumbnail_url || '',
              duration: item.duration || '0:00',
            },
            score: 50,
          });
        }
      });

      // Sort by score, take top tracks
      const sorted = Array.from(scoreMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_BACKUP_TRACKS);

      // Filter out already-downloaded tracks
      let downloadCount = 0;
      for (const { track } of sorted) {
        if (downloadCount >= MAX_DAILY_DOWNLOADS) break;

        const alreadyDownloaded = await isTrackDownloaded(track.videoId);
        if (alreadyDownloaded) continue;

        // Silent download (no toast)
        const success = await downloadTrack(track, true);
        if (success) downloadCount++;

        // Small delay between downloads
        await new Promise(r => setTimeout(r, 2000));
      }

      console.log(`[AutoBackup] Backed up ${downloadCount} tracks silently`);
    } catch (e) {
      console.error('[AutoBackup] Error:', e);
    } finally {
      markDone();
      runningRef.current = false;
    }
  }, [user, shouldRunToday, markDone, downloadTrack]);

  // Run backup 30 seconds after mount (to not block initial load)
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(runBackup, 30000);
    return () => clearTimeout(timer);
  }, [user, runBackup]);
};
