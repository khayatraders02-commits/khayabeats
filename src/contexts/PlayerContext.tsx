import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { Track, PlayerState } from '@/types/music';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDownloadedTrack } from '@/lib/offlineStorage';

interface PlayerContextType extends PlayerState {
  play: (track?: Track, queue?: Track[]) => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (newQueue: Track[]) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  isLoading: boolean;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

interface PlayerProviderProps {
  children: ReactNode;
}

// SINGLETON: Only ONE audio element ever exists to prevent overlapping
let singletonAudio: HTMLAudioElement | null = null;
let singletonInitialized = false;

const getSingletonAudio = (): HTMLAudioElement => {
  if (!singletonAudio) {
    singletonAudio = new Audio();
    singletonAudio.preload = 'auto';
    singletonInitialized = true;
  }
  return singletonAudio;
};

// Completely stop any audio playback
const stopAudio = () => {
  if (singletonAudio) {
    singletonAudio.pause();
    singletonAudio.currentTime = 0;
    singletonAudio.src = '';
    singletonAudio.load();
  }
};

export const PlayerProvider = ({ children }: PlayerProviderProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadingRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    volume: 1,
    queue: [],
    queueIndex: 0,
    shuffle: false,
    repeat: 'off',
  });

  // Initialize singleton audio
  useEffect(() => {
    // Stop any existing audio first
    stopAudio();
    audioRef.current = getSingletonAudio();
    audioRef.current.volume = state.volume;
    
    return () => {
      // Cleanup on unmount
      stopAudio();
    };
  }, []);

  // Save track to recently played
  const saveToRecentlyPlayed = useCallback(async (track: Track) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('recently_played').upsert({
          user_id: user.id,
          video_id: track.videoId,
          title: track.title,
          artist: track.artist,
          thumbnail_url: track.thumbnailUrl,
          duration: track.duration,
          played_at: new Date().toISOString(),
        }, { onConflict: 'user_id,video_id' });
      }
    } catch (e) {
      console.log('Failed to save recently played');
    }
  }, []);

  // Core function to load and play a track
  const loadAndPlayTrack = useCallback(async (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Prevent concurrent loads
    if (loadingRef.current) {
      console.log('Already loading, skipping...');
      return;
    }
    
    // If same track, just play/resume
    if (currentVideoIdRef.current === track.videoId && audio.src) {
      audio.play().catch(console.error);
      setState(prev => ({ ...prev, isPlaying: true }));
      return;
    }
    
    loadingRef.current = true;
    currentVideoIdRef.current = track.videoId;
    setIsLoading(true);
    
    // CRITICAL: Stop current audio completely before loading new
    audio.pause();
    audio.currentTime = 0;
    audio.src = '';
    
    try {
      console.log('Loading track:', track.title);
      
      // Check if track is downloaded offline first
      const offline = await getDownloadedTrack(track.videoId);
      let audioSource: string;
      
      if (offline) {
        console.log('Playing from offline storage');
        audioSource = URL.createObjectURL(offline.blob);
      } else {
        // Fetch from API
        const { data, error } = await supabase.functions.invoke('get-audio-stream', {
          body: { videoId: track.videoId },
        });

        if (error || !data?.success || !data?.audioUrl) {
          throw new Error(data?.error || 'Could not get audio stream');
        }
        
        audioSource = data.audioUrl;
      }

      // Double check we're still loading the same track
      if (currentVideoIdRef.current !== track.videoId) {
        console.log('Track changed during load, aborting');
        return;
      }
      
      // Set up audio
      audio.src = audioSource;
      
      // Wait for audio to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Load timeout')), 15000);
        
        const onCanPlay = () => {
          clearTimeout(timeout);
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          resolve();
        };
        
        const onError = () => {
          clearTimeout(timeout);
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          reject(new Error('Audio load error'));
        };
        
        audio.addEventListener('canplaythrough', onCanPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });
        audio.load();
      });
      
      // Play
      await audio.play();
      setState(prev => ({ ...prev, isPlaying: true, progress: 0 }));
      
      // Save to recently played (non-blocking)
      saveToRecentlyPlayed(track);
      
    } catch (error) {
      console.error('Error loading track:', error);
      toast.error('Could not play this track');
      setState(prev => ({ ...prev, isPlaying: false }));
      currentVideoIdRef.current = null;
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [saveToRecentlyPlayed]);

  const play = useCallback((track?: Track, queue?: Track[]) => {
    if (track) {
      const newQueue = queue || [track];
      const index = newQueue.findIndex(t => t.videoId === track.videoId);
      
      setState(prev => ({
        ...prev,
        currentTrack: track,
        queue: newQueue,
        queueIndex: index >= 0 ? index : 0,
      }));
      
      loadAndPlayTrack(track);
    } else if (audioRef.current && state.currentTrack) {
      audioRef.current.play().catch(console.error);
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [loadAndPlayTrack, state.currentTrack]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else if (audioRef.current && state.currentTrack) {
      audioRef.current.play().catch(console.error);
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, state.currentTrack, pause]);

  const next = useCallback(() => {
    const currentState = state;
    if (currentState.queue.length === 0) return;
    
    let nextIndex = currentState.queueIndex + 1;
    
    if (currentState.shuffle) {
      nextIndex = Math.floor(Math.random() * currentState.queue.length);
    } else if (nextIndex >= currentState.queue.length) {
      if (currentState.repeat === 'all') {
        nextIndex = 0;
      } else {
        pause();
        return;
      }
    }
    
    const nextTrack = currentState.queue[nextIndex];
    if (nextTrack) {
      setState(prev => ({
        ...prev,
        queueIndex: nextIndex,
        currentTrack: nextTrack,
        progress: 0,
      }));
      loadAndPlayTrack(nextTrack);
    }
  }, [state, loadAndPlayTrack, pause]);

  const previous = useCallback(() => {
    // If more than 3 seconds in, restart current track
    if (audioRef.current && state.progress > 3) {
      audioRef.current.currentTime = 0;
      setState(prev => ({ ...prev, progress: 0 }));
      return;
    }
    
    const currentState = state;
    let prevIndex = currentState.queueIndex - 1;
    
    if (prevIndex < 0) {
      if (currentState.repeat === 'all') {
        prevIndex = currentState.queue.length - 1;
      } else {
        return;
      }
    }
    
    const prevTrack = currentState.queue[prevIndex];
    if (prevTrack) {
      setState(prev => ({
        ...prev,
        queueIndex: prevIndex,
        currentTrack: prevTrack,
        progress: 0,
      }));
      loadAndPlayTrack(prevTrack);
    }
  }, [state, loadAndPlayTrack]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setState(prev => ({ ...prev, progress: time }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    setState(prev => ({ ...prev, volume }));
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setState(prev => ({
      ...prev,
      queue: [...prev.queue, track],
    }));
    toast.success('Added to queue');
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState(prev => {
      const newQueue = [...prev.queue];
      newQueue.splice(index, 1);
      return { ...prev, queue: newQueue };
    });
    toast.success('Removed from queue');
  }, []);

  const reorderQueue = useCallback((newQueue: Track[]) => {
    setState(prev => ({ ...prev, queue: newQueue }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState(prev => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setState(prev => ({
      ...prev,
      repeat: prev.repeat === 'off' ? 'all' : prev.repeat === 'all' ? 'one' : 'off',
    }));
  }, []);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setState(prev => ({ ...prev, progress: audio.currentTime }));
    };

    const handleDurationChange = () => {
      setState(prev => ({ ...prev, duration: audio.duration || 0 }));
    };

    const handleEnded = () => {
      if (state.repeat === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        next();
      }
    };

    const handlePlay = () => {
      setState(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    // Don't auto-skip on error - let user decide
    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      // Only show error if we were trying to play something
      if (currentVideoIdRef.current) {
        toast.error('Audio playback error');
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [next, state.repeat]);

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        play,
        pause,
        togglePlay,
        next,
        previous,
        seek,
        setVolume,
        addToQueue,
        removeFromQueue,
        reorderQueue,
        toggleShuffle,
        toggleRepeat,
        isLoading,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
