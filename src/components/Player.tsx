import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1, 
  Volume2, VolumeX, ChevronDown, ListMusic, Loader2, Music2, List, Share2, Cast
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { LyricsLine } from '@/types/music';
import { QueueView } from '@/components/QueueView';
import { DeviceConnectButton } from '@/components/DeviceConnect';

interface MiniPlayerProps {
  onExpand: () => void;
}

export const MiniPlayer = ({ onExpand }: MiniPlayerProps) => {
  const { currentTrack, isPlaying, progress, duration, togglePlay, isLoading } = usePlayer();

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-16 left-0 right-0 z-40"
    >
      <div className="mx-2 rounded-2xl kb-glass border border-border/50 overflow-hidden shadow-xl">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted/50">
          <motion.div 
            className="h-full kb-gradient-bg"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3" onClick={onExpand}>
          {/* Album art */}
          <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
            <img 
              src={currentTrack.thumbnailUrl} 
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
            {isPlaying && !isLoading && (
              <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
                <div className="flex gap-0.5 h-4 items-end">
                  {[...Array(4)].map((_, i) => (
                    <motion.div 
                      key={i} 
                      className="w-0.5 bg-primary rounded-full"
                      animate={{ 
                        height: ['20%', '100%', '20%'],
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.1,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {isLoading && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
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
            <motion.button 
              className="w-11 h-11 flex items-center justify-center rounded-full kb-gradient-bg text-primary-foreground shadow-lg disabled:opacity-50"
              onClick={togglePlay}
              disabled={isLoading}
              whileTap={{ scale: 0.95 }}
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} className="ml-0.5" />
              )}
            </motion.button>
          </div>
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
    isLoading,
  } = usePlayer();
  
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<LyricsLine[] | null>(null);
  const [activeLyricIndex, setActiveLyricIndex] = useState(0);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;
    
    const fetchLyrics = async () => {
      setLyricsLoading(true);
      setLyrics(null);
      setSyncedLyrics(null);
      setActiveLyricIndex(0);
      
      try {
        const { data, error } = await supabase.functions.invoke('get-lyrics', {
          body: { 
            artist: currentTrack.artist,
            title: currentTrack.title,
            duration: currentTrack.duration,
          },
        });
        
        if (error) throw error;
        
        if (data.syncedLyrics && data.syncedLyrics.length > 0) {
          setSyncedLyrics(data.syncedLyrics);
        }
        setLyrics(data.lyrics);
      } catch (error) {
        console.error('Lyrics error:', error);
        setLyrics(null);
        setSyncedLyrics(null);
      } finally {
        setLyricsLoading(false);
      }
    };
    
    fetchLyrics();
  }, [currentTrack?.videoId]);

  // Sync lyrics with playback
  useEffect(() => {
    if (!syncedLyrics || syncedLyrics.length === 0) return;

    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
      if (progress >= syncedLyrics[i].time) {
        if (i !== activeLyricIndex) {
          setActiveLyricIndex(i);
        }
        break;
      }
    }
  }, [progress, syncedLyrics, activeLyricIndex]);

  // Auto-scroll to active lyric
  useEffect(() => {
    if (!lyricsContainerRef.current || !syncedLyrics) return;
    
    const activeElement = lyricsContainerRef.current.querySelector(`[data-index="${activeLyricIndex}"]`);
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricIndex, syncedLyrics]);

  if (!currentTrack) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVolumeToggle = () => {
    if (isMuted) {
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleLyricClick = (time: number) => {
    seek(time);
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
    >
      {/* Dynamic background */}
      <div className="absolute inset-0 bg-background">
        <div 
          className="absolute inset-0 opacity-30 blur-3xl scale-110"
          style={{
            backgroundImage: `url(${currentTrack.thumbnailUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
      </div>

      {/* Content */}
      <div className="relative flex flex-col h-full safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <motion.button 
            onClick={onCollapse} 
            className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors"
            whileTap={{ scale: 0.9 }}
          >
            <ChevronDown size={28} className="text-muted-foreground" />
          </motion.button>
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Now Playing
          </span>
          <div className="flex items-center gap-1">
            <QueueView
              trigger={
                <motion.button 
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    "hover:bg-muted/50 text-muted-foreground"
                  )}
                  whileTap={{ scale: 0.9 }}
                >
                  <List size={22} />
                </motion.button>
              }
            />
            <DeviceConnectButton />
            <motion.button 
              onClick={() => setShowLyrics(!showLyrics)} 
              className={cn(
                "p-2 rounded-full transition-colors",
                showLyrics ? "bg-primary/20 text-primary" : "hover:bg-muted/50 text-muted-foreground"
              )}
              whileTap={{ scale: 0.9 }}
            >
              <ListMusic size={22} />
            </motion.button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-hidden px-6">
          <AnimatePresence mode="wait">
            {showLyrics ? (
              <motion.div
                key="lyrics"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-hidden"
              >
                {lyricsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                      <p className="text-muted-foreground">Finding lyrics...</p>
                    </div>
                  </div>
                ) : syncedLyrics && syncedLyrics.length > 0 ? (
                  <div 
                    ref={lyricsContainerRef}
                    className="h-full overflow-y-auto py-8 space-y-4 scrollbar-hide"
                  >
                    {syncedLyrics.map((line, index) => (
                      <motion.p
                        key={index}
                        data-index={index}
                        onClick={() => handleLyricClick(line.time)}
                        className={cn(
                          "text-center text-xl leading-relaxed cursor-pointer transition-all duration-300 px-4",
                          index === activeLyricIndex 
                            ? "text-foreground font-semibold scale-105" 
                            : "text-muted-foreground/50 hover:text-muted-foreground"
                        )}
                        animate={{
                          scale: index === activeLyricIndex ? 1.05 : 1,
                          opacity: index === activeLyricIndex ? 1 : 0.5,
                        }}
                      >
                        {line.text}
                      </motion.p>
                    ))}
                  </div>
                ) : lyrics ? (
                  <div className="h-full overflow-y-auto py-4">
                    <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-center text-muted-foreground">
                      {lyrics}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                      <Music2 size={40} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground mb-1">No lyrics available</p>
                    <p className="text-sm text-muted-foreground/50">We couldn't find lyrics for this track</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="artwork"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center h-full"
              >
                <div className="relative w-full max-w-xs">
                  {/* Glow effect */}
                  <motion.div 
                    className="absolute inset-0 rounded-3xl kb-gradient-bg opacity-30 blur-2xl"
                    animate={{
                      scale: isPlaying ? [1, 1.1, 1] : 1,
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  
                  {/* Album art */}
                  <motion.div 
                    className={cn(
                      "relative aspect-square rounded-3xl overflow-hidden shadow-2xl"
                    )}
                    animate={{ 
                      scale: isPlaying ? 1 : 0.95,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <img 
                      src={currentTrack.thumbnailUrl} 
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {isLoading && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="w-14 h-14 animate-spin text-primary" />
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom controls */}
        <div className="px-6 pb-6 pt-4">
          {/* Track info */}
          <div className="text-center mb-5">
            <h2 className="text-2xl font-bold mb-1 truncate">{currentTrack.title}</h2>
            <p className="text-muted-foreground">{currentTrack.artist}</p>
          </div>

          {/* Progress bar */}
          <div className="mb-5">
            <Slider
              value={[progress]}
              max={duration || 100}
              step={0.1}
              onValueChange={([val]) => seek(val)}
              className="mb-2"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main controls */}
          <div className="flex items-center justify-center gap-5 mb-5">
            <motion.button 
              onClick={toggleShuffle}
              className={cn(
                "p-2.5 rounded-full transition-colors",
                shuffle ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
              whileTap={{ scale: 0.9 }}
            >
              <Shuffle size={22} />
            </motion.button>
            
            <motion.button 
              onClick={previous} 
              className="p-2.5 text-foreground hover:text-primary transition-colors" 
              disabled={isLoading}
              whileTap={{ scale: 0.9 }}
            >
              <SkipBack size={32} fill="currentColor" />
            </motion.button>
            
            <motion.button 
              onClick={togglePlay}
              className="w-18 h-18 flex items-center justify-center rounded-full kb-gradient-bg text-primary-foreground shadow-xl disabled:opacity-50"
              disabled={isLoading}
              whileTap={{ scale: 0.95 }}
              style={{ width: 72, height: 72 }}
            >
              {isLoading ? (
                <Loader2 size={36} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={36} />
              ) : (
                <Play size={36} className="ml-1" />
              )}
            </motion.button>
            
            <motion.button 
              onClick={next} 
              className="p-2.5 text-foreground hover:text-primary transition-colors" 
              disabled={isLoading}
              whileTap={{ scale: 0.9 }}
            >
              <SkipForward size={32} fill="currentColor" />
            </motion.button>
            
            <motion.button 
              onClick={toggleRepeat}
              className={cn(
                "p-2.5 rounded-full transition-colors",
                repeat !== 'off' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
              whileTap={{ scale: 0.9 }}
            >
              {repeat === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
            </motion.button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3">
            <motion.button 
              onClick={handleVolumeToggle}
              whileTap={{ scale: 0.9 }}
            >
              {volume === 0 ? (
                <VolumeX size={22} className="text-muted-foreground" />
              ) : (
                <Volume2 size={22} className="text-muted-foreground" />
              )}
            </motion.button>
            <Slider
              value={[volume * 100]}
              max={100}
              step={1}
              onValueChange={([val]) => {
                setVolume(val / 100);
                setIsMuted(val === 0);
              }}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
