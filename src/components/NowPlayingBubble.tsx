import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music2 } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';

interface NowPlayingBubbleProps {
  onClick?: () => void;
  className?: string;
}

export const NowPlayingBubble = ({ onClick, className }: NowPlayingBubbleProps) => {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0, opacity: 0, y: 20 }}
        className={cn(
          "fixed z-50 flex items-center gap-3 px-3 py-2 rounded-full",
          "bg-background/95 backdrop-blur-xl border border-border/50",
          "shadow-2xl shadow-primary/20",
          "cursor-pointer select-none",
          className
        )}
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Thumbnail with animation */}
        <div className="relative">
          <motion.div
            className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary via-accent to-primary opacity-50 blur-sm"
            animate={{
              opacity: isPlaying ? [0.3, 0.6, 0.3] : 0.2,
              scale: isPlaying ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary/30">
            {currentTrack.thumbnailUrl ? (
              <motion.img
                src={currentTrack.thumbnailUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
            ) : (
              <div className="w-full h-full kb-gradient-bg flex items-center justify-center">
                <Music2 size={18} className="text-white" />
              </div>
            )}
          </div>
          
          {/* Playing indicator */}
          {isPlaying && (
            <motion.div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full flex items-center justify-center"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </motion.div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 max-w-32">
          <motion.p 
            className="text-sm font-medium truncate"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={currentTrack.id}
          >
            {currentTrack.title.length > 20 
              ? currentTrack.title.substring(0, 20) + '...'
              : currentTrack.title
            }
          </motion.p>
          <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
        </div>

        {/* Play/Pause Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="w-8 h-8 rounded-full kb-gradient-bg flex items-center justify-center shadow-lg"
        >
          {isPlaying ? (
            <Pause size={14} className="text-white" fill="white" />
          ) : (
            <Play size={14} className="text-white ml-0.5" fill="white" />
          )}
        </motion.button>

        {/* KHAYABEATS Badge */}
        <div className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-primary">
          <div className="w-1.5 h-1.5 rounded-full kb-gradient-bg" />
          KB
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Mini floating bubble for bottom-right corner
export const MiniNowPlayingBubble = ({ onClick }: { onClick?: () => void }) => {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();

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
        className="relative w-14 h-14 rounded-full overflow-hidden shadow-2xl shadow-primary/30 ring-2 ring-primary/30"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Pulsing ring */}
        <motion.div
          className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary to-accent"
          animate={{
            opacity: isPlaying ? [0.3, 0.7, 0.3] : 0.3,
            scale: isPlaying ? [1, 1.15, 1] : 1,
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        
        {/* Thumbnail */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {currentTrack.thumbnailUrl ? (
            <motion.img
              src={currentTrack.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <div className="w-full h-full kb-gradient-bg flex items-center justify-center">
              <Music2 size={24} className="text-white" />
            </div>
          )}
        </div>

        {/* Play indicator overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          {isPlaying ? (
            <motion.div 
              className="flex gap-0.5"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-white rounded-full"
                  animate={{ height: ['8px', '16px', '8px'] }}
                  transition={{ 
                    duration: 0.5, 
                    repeat: Infinity, 
                    delay: i * 0.15 
                  }}
                />
              ))}
            </motion.div>
          ) : (
            <Play size={20} className="text-white ml-0.5" fill="white" />
          )}
        </div>

        {/* KHAYABEATS watermark */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-background/90 rounded-full">
          <span className="text-[8px] font-bold kb-gradient-text">KB</span>
        </div>
      </motion.button>
    </motion.div>
  );
};

export default NowPlayingBubble;
