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
  audioElement: HTMLAudioElement | null;
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

const getSingletonAudio = (): HTMLAudioElement => {
  if (!singletonAudio) {
    singletonAudio = new Audio();
    singletonAudio.preload = 'metadata';
    // Enable background playback on mobile
    singletonAudio.setAttribute('playsinline', 'true');
    singletonAudio.setAttribute('webkit-playsinline', 'true');
  }
  return singletonAudio;
};

// Completely stop any audio playback
const stopAudioCompletely = () => {
  if (singletonAudio) {
    try {
      singletonAudio.pause();
      singletonAudio.currentTime = 0;
      // Clear source properly
      singletonAudio.removeAttribute('src');
      singletonAudio.load();
    } catch (e) {
      console.log('Error stopping audio:', e);
    }
  }
};

export const PlayerProvider = ({ children }: PlayerProviderProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadingRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 2;
  
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

  // Initialize singleton audio once
  useEffect(() => {
    stopAudioCompletely();
    audioRef.current = getSingletonAudio();
    audioRef.current.volume = state.volume;
    
    return () => {
      // Don't destroy on unmount - keep singleton
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

  // Update user presence (for jam sessions)
  const updatePresence = useCallback(async (track: Track | null, playing: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_presence').upsert({
          user_id: user.id,
          current_track_id: track?.videoId || null,
          current_track_data: track ? {
            title: track.title,
            artist: track.artist,
            thumbnailUrl: track.thumbnailUrl,
          } : null,
          is_playing: playing,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
    } catch (e) {
      // Silent fail for presence
    }
  }, []);

  // Core function to load and play a track
  const loadAndPlayTrack = useCallback(async (track: Track) => {
    const audio = audioRef.current;
    if (!audio) {
      console.error('No audio element');
      return;
    }
    
    // Prevent concurrent loads
    if (loadingRef.current && currentVideoIdRef.current === track.videoId) {
      console.log('Already loading this track, skipping...');
      return;
    }
    
    // If same track is already loaded and ready, just play/resume
    if (currentVideoIdRef.current === track.videoId && audio.src && audio.readyState >= 2) {
      try {
        await audio.play();
        setState(prev => ({ ...prev, isPlaying: true }));
        updatePresence(track, true);
        return;
      } catch (e) {
        // Continue to full reload
      }
    }
    
    loadingRef.current = true;
    currentVideoIdRef.current = track.videoId;
    setIsLoading(true);
    retryCountRef.current = 0;
    
    // CRITICAL: Stop current audio completely before loading new
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {
      console.log('Error pausing:', e);
    }
    
    const attemptLoad = async (): Promise<boolean> => {
      try {
        console.log(`Loading track: ${track.title} (attempt ${retryCountRef.current + 1})`);
        
        // Check if track is downloaded offline first
        const offline = await getDownloadedTrack(track.videoId);
        let audioSource: string;
        
        if (offline) {
          console.log('Playing from offline storage');
          audioSource = URL.createObjectURL(offline.blob);
        } else {
          // Fetch from API - send title/artist for Audius matching
          const { data, error } = await supabase.functions.invoke('get-audio-stream', {
            body: { 
              videoId: track.videoId,
              title: track.title,
              artist: track.artist,
            },
          });

          if (error) {
            throw new Error(error.message || 'Network error');
          }
          
          if (!data?.success || !data?.audioUrl) {
            throw new Error(data?.error || 'Could not get audio stream');
          }
          
          audioSource = data.audioUrl;
        }

        // Double check we're still loading the same track
        if (currentVideoIdRef.current !== track.videoId) {
          console.log('Track changed during load, aborting');
          return false;
        }
        
        // Set up audio source
        audio.src = audioSource;
        
        // Wait for audio to be ready
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Load timeout')), 20000);
          
          const cleanup = () => {
            clearTimeout(timeout);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('error', onError);
          };
          
          const onCanPlay = () => {
            cleanup();
            resolve();
          };
          
          const onError = (e: Event) => {
            cleanup();
            const mediaError = audio.error;
            reject(new Error(mediaError?.message || 'Audio load error'));
          };
          
          audio.addEventListener('canplay', onCanPlay, { once: true });
          audio.addEventListener('error', onError, { once: true });
          audio.load();
        });
        
        // Final check before playing
        if (currentVideoIdRef.current !== track.videoId) {
          return false;
        }
        
        // Play
        await audio.play();
        
        setState(prev => ({ ...prev, isPlaying: true, progress: 0 }));
        updatePresence(track, true);
        saveToRecentlyPlayed(track);
        
        return true;
        
      } catch (error) {
        console.error('Load attempt failed:', error);
        
        // Retry logic
        if (retryCountRef.current < maxRetries && currentVideoIdRef.current === track.videoId) {
          retryCountRef.current++;
          console.log(`Retrying... (${retryCountRef.current}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 1000));
          return attemptLoad();
        }
        
        throw error;
      }
    };
    
    try {
      await attemptLoad();
    } catch (error) {
      console.error('Error loading track:', error);
      toast.error('Could not play this track. Try another one.');
      setState(prev => ({ ...prev, isPlaying: false }));
      currentVideoIdRef.current = null;
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [saveToRecentlyPlayed, updatePresence]);

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
      updatePresence(state.currentTrack, true);
    }
  }, [loadAndPlayTrack, state.currentTrack, updatePresence]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setState(prev => ({ ...prev, isPlaying: false }));
    updatePresence(state.currentTrack, false);
  }, [state.currentTrack, updatePresence]);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else if (audioRef.current && state.currentTrack) {
      audioRef.current.play().catch(console.error);
      setState(prev => ({ ...prev, isPlaying: true }));
      updatePresence(state.currentTrack, true);
    }
  }, [state.isPlaying, state.currentTrack, pause, updatePresence]);

  const next = useCallback(() => {
    const currentState = state;
    if (currentState.queue.length === 0) return;
    
    let nextIndex = currentState.queueIndex + 1;
    
    if (currentState.shuffle) {
      // Random but not the same track
      do {
        nextIndex = Math.floor(Math.random() * currentState.queue.length);
      } while (nextIndex === currentState.queueIndex && currentState.queue.length > 1);
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
        // Just restart current track
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          setState(prev => ({ ...prev, progress: 0 }));
        }
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
    if (audioRef.current && !isNaN(time)) {
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
      
      // Adjust queueIndex if needed
      let newQueueIndex = prev.queueIndex;
      if (index < prev.queueIndex) {
        newQueueIndex = Math.max(0, prev.queueIndex - 1);
      } else if (index === prev.queueIndex && newQueue.length > 0) {
        newQueueIndex = Math.min(newQueueIndex, newQueue.length - 1);
      }
      
      return { ...prev, queue: newQueue, queueIndex: newQueueIndex };
    });
    toast.success('Removed from queue');
  }, []);

  const reorderQueue = useCallback((newQueue: Track[]) => {
    setState(prev => ({ ...prev, queue: newQueue }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState(prev => ({ ...prev, shuffle: !prev.shuffle }));
    toast.success(state.shuffle ? 'Shuffle off' : 'Shuffle on');
  }, [state.shuffle]);

  const toggleRepeat = useCallback(() => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(state.repeat);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setState(prev => ({ ...prev, repeat: nextMode }));
    
    const messages = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };
    toast.success(messages[nextMode]);
  }, [state.repeat]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isNaN(audio.currentTime)) {
        setState(prev => ({ ...prev, progress: audio.currentTime }));
      }
    };

    const handleDurationChange = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setState(prev => ({ ...prev, duration: audio.duration }));
      }
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

    const handleError = (e: Event) => {
      console.error('Audio error event:', e);
      // Only show error if we were actively loading
      if (loadingRef.current) {
        // Error will be handled in loadAndPlayTrack
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
        audioElement: audioRef.current,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
