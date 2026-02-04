import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music2, SkipForward, SkipBack, Download, X } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { KhayaBeatsCover } from '@/components/KhayaBeatsCover';

interface NowPlayingBubbleProps {
  onClick?: () => void;
  className?: string;
}

// Main Dynamic Island - Full width bar at bottom
export const NowPlayingBubble = ({ onClick, className }: NowPlayingBubbleProps) => {
  const { currentTrack, isPlaying, togglePlay, progress, duration, next, previous, isLoading } = usePlayer();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={cn(
          "fixed bottom-20 left-2 right-2 z-50",
          className
        )}
      >
        <motion.div
          layout
          className={cn(
            "relative overflow-hidden rounded-2xl",
            "bg-gradient-to-r from-zinc-900/98 via-zinc-800/98 to-zinc-900/98",
            "backdrop-blur-xl border border-white/10",
            "shadow-2xl shadow-black/50"
          )}
          animate={{
            height: isExpanded ? 180 : 72,
          }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Progress bar - Top edge glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-700/50 overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-primary via-accent to-primary"
              style={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          {/* Main compact view */}
          <div 
            className="flex items-center gap-3 px-3 py-3 cursor-pointer"
            onClick={() => onClick?.()}
          >
            {/* Album Art with rotating animation */}
            <div className="relative flex-shrink-0">
              <motion.div
                className="absolute -inset-1 rounded-xl bg-gradient-to-br from-primary/40 via-accent/30 to-primary/40 blur-sm"
                animate={{
                  opacity: isPlaying ? [0.4, 0.7, 0.4] : 0.3,
                  scale: isPlaying ? [1, 1.05, 1] : 1,
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <div className="relative w-12 h-12 rounded-xl overflow-hidden ring-1 ring-white/20">
                {currentTrack.thumbnailUrl ? (
                  <motion.img
                    src={currentTrack.thumbnailUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    animate={{ rotate: isPlaying ? 360 : 0 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  <KhayaBeatsCover title={currentTrack.title} subtitle={currentTrack.artist} size="sm" />
                )}
                
                {/* Playing indicator */}
                {isPlaying && !isLoading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <motion.div className="flex gap-0.5 h-4 items-end">
                      {[1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-white rounded-full"
                          animate={{ height: ['4px', '14px', '4px'] }}
                          transition={{ 
                            duration: 0.6, 
                            repeat: Infinity, 
                            delay: i * 0.1 
                          }}
                        />
                      ))}
                    </motion.div>
                  </div>
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <motion.p 
                className="font-semibold text-sm text-white truncate"
                key={currentTrack.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {currentTrack.title}
              </motion.p>
              <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Previous */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={previous}
                className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <SkipBack size={18} fill="currentColor" />
              </motion.button>
              
              {/* Play/Pause */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={togglePlay}
                disabled={isLoading}
                className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-lg"
              >
                {isLoading ? (
                  <motion.div
                    className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                ) : isPlaying ? (
                  <Pause size={18} className="text-zinc-900" fill="currentColor" />
                ) : (
                  <Play size={18} className="text-zinc-900 ml-0.5" fill="currentColor" />
                )}
              </motion.button>
              
              {/* Next */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={next}
                className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <SkipForward size={18} fill="currentColor" />
              </motion.button>
            </div>

            {/* KHAYABEATS Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30">
              <motion.div 
                className="w-2 h-2 rounded-full bg-gradient-to-r from-primary to-accent"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[10px] font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                KHAYABEATS
              </span>
            </div>
          </div>

          {/* Expanded view with more controls */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-4 pb-4"
              >
                {/* Additional controls will go here */}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Floating circular bubble - Alternative style
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
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Outer glow ring */}
        <motion.div
          className="absolute -inset-2 rounded-full bg-gradient-to-br from-primary via-accent to-primary"
          animate={{
            opacity: isPlaying ? [0.3, 0.6, 0.3] : 0.2,
            scale: isPlaying ? [1, 1.1, 1] : 1,
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        
        {/* Main bubble */}
        <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-2xl shadow-primary/40 ring-2 ring-white/20">
          {/* Background */}
          {currentTrack.thumbnailUrl ? (
            <motion.img
              src={currentTrack.thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <KhayaBeatsCover 
              title={currentTrack.title} 
              subtitle={currentTrack.artist} 
              size="sm" 
              className="absolute inset-0"
            />
          )}

          {/* Overlay with controls */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            {isLoading ? (
              <motion.div
                className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            ) : isPlaying ? (
              <motion.div 
                className="flex gap-1"
                animate={{ opacity: [1, 0.6, 1] }}
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
              <Play size={24} className="text-white ml-1" fill="white" />
            )}
          </div>
        </div>

        {/* KHAYABEATS badge */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-900/95 rounded-full border border-white/10">
          <span className="text-[8px] font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            KB
          </span>
        </div>
      </motion.button>
    </motion.div>
  );
};

export default NowPlayingBubble;
