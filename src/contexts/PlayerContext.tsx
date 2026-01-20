import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { Track, PlayerState } from '@/types/music';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export const PlayerProvider = ({ children }: PlayerProviderProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = state.volume;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Fetch audio stream and play
  const loadAndPlayTrack = useCallback(async (track: Track) => {
    if (!audioRef.current) return;
    
    setIsLoading(true);
    
    try {
      console.log('Fetching audio stream for:', track.title);
      
      const { data, error } = await supabase.functions.invoke('get-audio-stream', {
        body: { videoId: track.videoId },
      });

      if (error) throw error;
      
      if (!data.success || !data.audioUrl) {
        throw new Error(data.error || 'Could not get audio stream');
      }

      console.log('Got audio URL, loading...', data.mimeType);
      
      const audio = audioRef.current;
      
      // Try the proxied URL first, fallback to direct if needed
      const tryPlayAudio = async (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
          audio.src = url;
          
          const handleCanPlay = () => {
            cleanup();
            resolve(true);
          };
          
          const handleError = () => {
            cleanup();
            resolve(false);
          };
          
          const cleanup = () => {
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
          };
          
          audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
          audio.addEventListener('error', handleError, { once: true });
          
          audio.load();
          
          // Timeout after 8 seconds
          setTimeout(() => {
            cleanup();
            resolve(false);
          }, 8000);
        });
      };
      
      // Try proxied URL first
      let canPlay = await tryPlayAudio(data.audioUrl);
      
      // If proxy fails and we have a direct URL, try that
      if (!canPlay && data.directUrl) {
        console.log('Proxy failed, trying direct URL...');
        canPlay = await tryPlayAudio(data.directUrl);
      }
      
      if (!canPlay) {
        throw new Error('Could not load audio from any source');
      }
      
      await audio.play();
      setState(prev => ({ ...prev, isPlaying: true }));
      
      // Save to recently played (fire and forget)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('recently_played').insert({
            user_id: user.id,
            video_id: track.videoId,
            title: track.title,
            artist: track.artist,
            thumbnail_url: track.thumbnailUrl,
            duration: track.duration,
          }).then(() => {});
        }
      });
      
    } catch (error) {
      console.error('Error loading track:', error);
      toast.error('Failed to play track. Try another one.');
      setState(prev => ({ ...prev, isPlaying: false }));
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      audioRef.current.play();
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
      audioRef.current.play();
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, state.currentTrack, pause]);

  const next = useCallback(() => {
    setState(prev => {
      if (prev.queue.length === 0) return prev;
      
      let nextIndex = prev.queueIndex + 1;
      
      if (prev.shuffle) {
        nextIndex = Math.floor(Math.random() * prev.queue.length);
      } else if (nextIndex >= prev.queue.length) {
        if (prev.repeat === 'all') {
          nextIndex = 0;
        } else {
          return { ...prev, isPlaying: false };
        }
      }
      
      const nextTrack = prev.queue[nextIndex];
      loadAndPlayTrack(nextTrack);
      
      return {
        ...prev,
        queueIndex: nextIndex,
        currentTrack: nextTrack,
        progress: 0,
      };
    });
  }, [loadAndPlayTrack]);

  const previous = useCallback(() => {
    if (audioRef.current && state.progress > 3) {
      audioRef.current.currentTime = 0;
      setState(prev => ({ ...prev, progress: 0 }));
      return;
    }
    
    setState(prev => {
      const prevIndex = prev.queueIndex - 1;
      if (prevIndex < 0) {
        if (prev.repeat === 'all') {
          const lastTrack = prev.queue[prev.queue.length - 1];
          loadAndPlayTrack(lastTrack);
          return {
            ...prev,
            queueIndex: prev.queue.length - 1,
            currentTrack: lastTrack,
            progress: 0,
          };
        }
        return prev;
      }
      
      const prevTrack = prev.queue[prevIndex];
      loadAndPlayTrack(prevTrack);
      
      return {
        ...prev,
        queueIndex: prevIndex,
        currentTrack: prevTrack,
        progress: 0,
      };
    });
  }, [state.progress, loadAndPlayTrack]);

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

  // Handle audio events
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
        audio.play();
      } else {
        next();
      }
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      toast.error('Audio playback error. Trying next track...');
      next();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
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
