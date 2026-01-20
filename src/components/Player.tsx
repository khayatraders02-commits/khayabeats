import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1, Volume2, VolumeX, ChevronDown, ListMusic } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

interface MiniPlayerProps {
  onExpand: () => void;
}

export const MiniPlayer = ({ onExpand }: MiniPlayerProps) => {
  const { currentTrack, isPlaying, progress, duration, togglePlay } = usePlayer();

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 kb-glass border-t border-border z-50 safe-area-bottom"
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div 
          className="h-full kb-gradient-bg transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-3 pt-4" onClick={onExpand}>
        {/* Album art */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          <img 
            src={currentTrack.thumbnailUrl} 
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
          {isPlaying && (
            <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
              <div className="flex gap-0.5 h-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-0.5 bg-primary kb-equalizer-bar" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{currentTrack.title}</p>
          <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface FullPlayerProps {
  onCollapse: () => void;
}

export const FullPlayer = ({ onCollapse }: FullPlayerProps) => {
  const { 
    currentTrack, 
    isPlaying, 
    progress, 
    duration, 
    volume,
    shuffle,
    repeat,
    togglePlay, 
    next, 
    previous,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();
  
  const [showLyrics, setShowLyrics] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  if (!currentTrack) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVolumeToggle = () => {
    if (isMuted) {
      setVolume(1);
      setIsMuted(false);
    } else {
      setVolume(0);
      setIsMuted(true);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-50 kb-player-gradient flex flex-col safe-area-top safe-area-bottom"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <button onClick={onCollapse} className="p-2 -ml-2">
          <ChevronDown size={28} className="text-muted-foreground" />
        </button>
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Now Playing
        </span>
        <button onClick={() => setShowLyrics(!showLyrics)} className="p-2 -mr-2">
          <ListMusic size={24} className={cn(showLyrics && "text-primary")} />
        </button>
      </div>

      {/* Album Art */}
      <div className="flex-1 flex items-center justify-center px-8 py-4">
        <motion.div 
          className={cn(
            "relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden shadow-2xl",
            isPlaying && "kb-glow"
          )}
          animate={{ scale: isPlaying ? 1 : 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <img 
            src={currentTrack.thumbnailUrl} 
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
          
          {/* Vinyl effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
        </motion.div>
      </div>

      {/* Track Info & Controls */}
      <div className="px-8 pb-8">
        {/* Track info */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-1 truncate">{currentTrack.title}</h2>
          <p className="text-muted-foreground">{currentTrack.artist}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <Slider
            value={[progress]}
            max={duration || 100}
            step={1}
            onValueChange={([val]) => seek(val)}
            className="mb-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <button 
            onClick={toggleShuffle}
            className={cn("p-2", shuffle && "text-primary")}
          >
            <Shuffle size={20} />
          </button>
          
          <button onClick={previous} className="p-2">
            <SkipBack size={28} fill="currentColor" />
          </button>
          
          <button 
            onClick={togglePlay}
            className="w-16 h-16 flex items-center justify-center rounded-full kb-gradient-bg text-primary-foreground shadow-lg kb-glow"
          >
            {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
          </button>
          
          <button onClick={next} className="p-2">
            <SkipForward size={28} fill="currentColor" />
          </button>
          
          <button 
            onClick={toggleRepeat}
            className={cn("p-2", repeat !== 'off' && "text-primary")}
          >
            {repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <button onClick={handleVolumeToggle}>
            {volume === 0 ? <VolumeX size={20} className="text-muted-foreground" /> : <Volume2 size={20} className="text-muted-foreground" />}
          </button>
          <Slider
            value={[volume * 100]}
            max={100}
            step={1}
            onValueChange={([val]) => setVolume(val / 100)}
            className="flex-1"
          />
        </div>
      </div>
    </motion.div>
  );
};
