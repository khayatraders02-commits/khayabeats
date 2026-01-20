import { motion } from 'framer-motion';
import { Play, Heart, MoreHorizontal, Download } from 'lucide-react';
import { Track } from '@/types/music';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';

interface TrackCardProps {
  track: Track;
  index?: number;
  queue?: Track[];
  onFavorite?: () => void;
  isFavorite?: boolean;
  showIndex?: boolean;
}

export const TrackCard = ({ 
  track, 
  index, 
  queue,
  onFavorite, 
  isFavorite,
  showIndex 
}: TrackCardProps) => {
  const { play, currentTrack, isPlaying } = usePlayer();
  const isCurrentTrack = currentTrack?.videoId === track.videoId;

  const handlePlay = () => {
    play(track, queue);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer",
        isCurrentTrack ? "bg-primary/10" : "hover:bg-muted/50"
      )}
      onClick={handlePlay}
    >
      {/* Index or play indicator */}
      {showIndex && (
        <div className="w-8 text-center">
          {isCurrentTrack && isPlaying ? (
            <div className="flex justify-center gap-0.5 h-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-0.5 bg-primary kb-equalizer-bar" />
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground group-hover:hidden">
              {index !== undefined ? index + 1 : ''}
            </span>
          )}
          <Play 
            size={16} 
            className={cn(
              "hidden group-hover:block mx-auto",
              isCurrentTrack && isPlaying && "hidden"
            )} 
            fill="currentColor"
          />
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
        <img 
          src={track.thumbnailUrl} 
          alt={track.title}
          className="w-full h-full object-cover"
        />
        {!showIndex && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={20} fill="currentColor" />
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium text-sm truncate",
          isCurrentTrack && "text-primary"
        )}>
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
      </div>

      {/* Duration */}
      <span className="text-xs text-muted-foreground">{track.duration}</span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        {onFavorite && (
          <button 
            className="p-2 hover:bg-muted rounded-full transition-colors"
            onClick={onFavorite}
          >
            <Heart 
              size={18} 
              className={cn(isFavorite && "fill-primary text-primary")} 
            />
          </button>
        )}
        <button className="p-2 hover:bg-muted rounded-full transition-colors">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </motion.div>
  );
};

interface AlbumCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  onClick?: () => void;
}

export const AlbumCard = ({ title, subtitle, imageUrl, onClick }: AlbumCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 shadow-lg">
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <button className="absolute bottom-3 right-3 w-12 h-12 rounded-full kb-gradient-bg flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
          <Play size={24} fill="white" className="text-white ml-0.5" />
        </button>
      </div>
      <h3 className="font-semibold text-sm truncate">{title}</h3>
      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
    </motion.div>
  );
};
