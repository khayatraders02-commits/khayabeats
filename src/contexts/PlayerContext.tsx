import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { Track, PlayerState } from '@/types/music';

interface PlayerContextType extends PlayerState {
  play: (track?: Track, queue?: Track[]) => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: Track) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
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
  const audioRef = useRef<HTMLAudioElement>(null);
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

  const play = useCallback((track?: Track, queue?: Track[]) => {
    if (track) {
      const newQueue = queue || [track];
      const index = newQueue.findIndex(t => t.videoId === track.videoId);
      setState(prev => ({
        ...prev,
        currentTrack: track,
        queue: newQueue,
        queueIndex: index >= 0 ? index : 0,
        isPlaying: true,
      }));
    } else {
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, []);

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const togglePlay = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

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
      
      return {
        ...prev,
        queueIndex: nextIndex,
        currentTrack: prev.queue[nextIndex],
        progress: 0,
      };
    });
  }, []);

  const previous = useCallback(() => {
    setState(prev => {
      if (prev.progress > 3) {
        // If more than 3 seconds in, restart the track
        if (audioRef.current) audioRef.current.currentTime = 0;
        return { ...prev, progress: 0 };
      }
      
      const prevIndex = prev.queueIndex - 1;
      if (prevIndex < 0) {
        if (prev.repeat === 'all') {
          return {
            ...prev,
            queueIndex: prev.queue.length - 1,
            currentTrack: prev.queue[prev.queue.length - 1],
            progress: 0,
          };
        }
        return prev;
      }
      
      return {
        ...prev,
        queueIndex: prevIndex,
        currentTrack: prev.queue[prevIndex],
        progress: 0,
      };
    });
  }, []);

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

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [next, state.repeat]);

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state.isPlaying) {
      audio.play().catch(() => {
        setState(prev => ({ ...prev, isPlaying: false }));
      });
    } else {
      audio.pause();
    }
  }, [state.isPlaying, state.currentTrack]);

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
        toggleShuffle,
        toggleRepeat,
        audioRef,
      }}
    >
      <audio ref={audioRef} />
      {children}
    </PlayerContext.Provider>
  );
};
