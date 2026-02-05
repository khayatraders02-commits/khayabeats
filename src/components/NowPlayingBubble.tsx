import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Heart, Download, Volume2 } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NowPlayingBubbleProps {
  onClick?: () => void;
  className?: string;
}

// Main Dynamic Island - Premium design
export const NowPlayingBubble = ({ onClick, className }: NowPlayingBubbleProps) => {
  const { currentTrack, isPlaying, togglePlay, progress, duration, next, previous, isLoading } = usePlayer();

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          "fixed z-50",
          className
        )}
      >
        {/* Outer glow */}
        <motion.div
          className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 blur-xl"
          animate={{
            opacity: isPlaying ? [0.3, 0.5, 0.3] : 0.2,
            scale: isPlaying ? [1, 1.02, 1] : 1,
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        <motion.div
          className={cn(
            "relative overflow-hidden rounded-3xl",
            "bg-gradient-to-br from-zinc-900/95 via-zinc-800/95 to-zinc-900/95",
            "backdrop-blur-2xl border border-white/10",
            "shadow-2xl shadow-black/60"
          )}
        >
          {/* Progress bar - Top edge with gradient glow */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-zinc-700/30 overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
              style={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1 }}
            />
            {/* Glowing tip */}
            <motion.div
              className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              style={{ left: `${Math.max(0, progressPercent - 4)}%` }}
              animate={{ opacity: isPlaying ? [0.5, 1, 0.5] : 0.3 }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>

          {/* Main content */}
          <div 
            className="flex items-center gap-4 px-4 py-4 cursor-pointer"
            onClick={() => onClick?.()}
          >
            {/* Album Art with spinning animation */}
            <div className="relative flex-shrink-0">
              {/* Glow ring */}
              <motion.div
                className="absolute -inset-1.5 rounded-2xl bg-gradient-to-br from-primary/50 via-accent/40 to-primary/50"
                animate={{
                  opacity: isPlaying ? [0.5, 0.8, 0.5] : 0.3,
                  rotate: isPlaying ? 360 : 0,
                }}
                transition={{ 
                  opacity: { duration: 2, repeat: Infinity },
                  rotate: { duration: 8, repeat: Infinity, ease: 'linear' }
                }}
              />
              
              {/* Album art container */}
              <div className="relative w-14 h-14 rounded-xl overflow-hidden ring-2 ring-white/20 shadow-lg">
                <motion.img
                  src={currentTrack.thumbnailUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                  animate={{ 
                    scale: isPlaying ? [1, 1.05, 1] : 1,
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
                
                {/* Vinyl effect when playing */}
                {isPlaying && !isLoading && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                
                {/* Playing bars indicator */}
                {isPlaying && !isLoading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <motion.div className="flex gap-0.5 h-5 items-end">
                      {[1, 2, 3, 4].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-white rounded-full shadow-glow"
                          animate={{ height: ['4px', '16px', '4px'] }}
                          transition={{ 
                            duration: 0.5 + i * 0.1, 
                            repeat: Infinity, 
                            delay: i * 0.08 
                          }}
                        />
                      ))}
                    </motion.div>
                  </div>
                )}
                
                {/* Loading spinner */}
                {isLoading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <motion.div
                      className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <motion.p 
                className="font-bold text-white truncate text-sm"
                key={currentTrack.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {currentTrack.title}
              </motion.p>
              <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
              
              {/* Mini time display */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-zinc-500">
                  {formatTime(progress)} / {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Previous */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={previous}
                className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <SkipBack size={18} fill="currentColor" />
              </motion.button>
              
              {/* Play/Pause - Main button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={togglePlay}
                disabled={isLoading}
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shadow-xl",
                  "bg-gradient-to-br from-white to-zinc-200",
                  "hover:from-primary hover:to-accent transition-all duration-300"
                )}
              >
                {isLoading ? (
                  <motion.div
                    className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                ) : isPlaying ? (
                  <Pause size={20} className="text-zinc-900" fill="currentColor" />
                ) : (
                  <Play size={20} className="text-zinc-900 ml-0.5" fill="currentColor" />
                )}
              </motion.button>
              
              {/* Next */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={next}
                className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <SkipForward size={18} fill="currentColor" />
              </motion.button>
            </div>

            {/* KHAYABEATS Badge */}
            <motion.div 
              className="hidden sm:flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30"
              animate={{ 
                boxShadow: isPlaying 
                  ? ['0 0 0 0 rgba(var(--primary), 0)', '0 0 20px 2px rgba(var(--primary), 0.3)', '0 0 0 0 rgba(var(--primary), 0)']
                  : '0 0 0 0 rgba(var(--primary), 0)'
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <motion.div 
                className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-primary to-accent"
                animate={{ scale: isPlaying ? [1, 1.3, 1] : 1 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[9px] font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tracking-wider">
                KHAYABEATS
              </span>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Compact floating bubble for mobile
export const MiniNowPlayingBubble = ({ onClick }: { onClick?: () => void }) => {
  const { currentTrack, isPlaying, togglePlay, isLoading } = usePlayer();

  if (!currentTrack) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed bottom-24 right-4 z-40"
    >
      <motion.button
        onClick={onClick}
        className="relative group"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Animated outer ring */}
        <motion.div
          className="absolute -inset-3 rounded-full bg-gradient-conic from-primary via-accent to-primary"
          animate={{
            rotate: isPlaying ? 360 : 0,
            opacity: isPlaying ? [0.3, 0.6, 0.3] : 0.2,
          }}
          transition={{ 
            rotate: { duration: 4, repeat: Infinity, ease: 'linear' },
            opacity: { duration: 2, repeat: Infinity }
          }}
        />
        
        {/* Inner glow */}
        <motion.div
          className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/60 via-accent/60 to-primary/60 blur-sm"
          animate={{
            scale: isPlaying ? [1, 1.15, 1] : 1,
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        
        {/* Main bubble */}
        <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-2xl shadow-primary/40 ring-2 ring-white/30">
          <motion.img
            src={currentTrack.thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          />

          {/* Center overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            {isLoading ? (
              <motion.div
                className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            ) : isPlaying ? (
              <motion.div 
                className="flex gap-1 items-end h-6"
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-white rounded-full"
                    animate={{ height: ['8px', '20px', '8px'] }}
                    transition={{ 
                      duration: 0.5, 
                      repeat: Infinity, 
                      delay: i * 0.12 
                    }}
                  />
                ))}
              </motion.div>
            ) : (
              <Play size={22} className="text-white ml-1" fill="white" />
            )}
          </div>
        </div>

        {/* KB badge */}
        <motion.div 
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-zinc-900/95 rounded-full border border-primary/40"
          animate={{ 
            scale: isPlaying ? [1, 1.05, 1] : 1,
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-[8px] font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            KB
          </span>
        </motion.div>
      </motion.button>
    </motion.div>
  );
};

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default NowPlayingBubble;
