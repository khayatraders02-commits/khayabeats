import { motion } from 'framer-motion';
import { Play, Heart, MoreHorizontal, Download, Check, Loader2, Trash2, Plus } from 'lucide-react';
import { Track, Playlist } from '@/types/music';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { isTrackDownloaded } from '@/lib/offlineStorage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TrackCardProps {
  track: Track;
  index?: number;
  queue?: Track[];
  onFavorite?: () => void;
  isFavorite?: boolean;
  showIndex?: boolean;
  onDownload?: () => void;
  onRemoveDownload?: () => void;
  isDownloading?: boolean;
  downloadProgress?: number;
  playlists?: Playlist[];
  onAddToPlaylist?: (playlistId: string) => void;
  compact?: boolean;
}

export const TrackCard = ({ 
  track, 
  index, 
  queue,
  onFavorite, 
  isFavorite,
  showIndex,
  onDownload,
  onRemoveDownload,
  isDownloading,
  downloadProgress,
  playlists,
  onAddToPlaylist,
  compact,
}: TrackCardProps) => {
  const { play, currentTrack, isPlaying } = usePlayer();
  const isCurrentTrack = currentTrack?.videoId === track.videoId;
  const [isDownloaded, setIsDownloaded] = useState(false);

  useEffect(() => {
    isTrackDownloaded(track.videoId).then(setIsDownloaded);
  }, [track.videoId]);

  const handlePlay = () => {
    play(track, queue);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01, backgroundColor: 'hsl(var(--muted) / 0.5)' }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "group flex items-center gap-3 rounded-xl transition-all cursor-pointer",
        compact ? "p-2" : "p-3",
        isCurrentTrack ? "bg-primary/10" : ""
      )}
      onClick={handlePlay}
    >
      {/* Index or play indicator */}
      {showIndex && (
        <div className="w-8 text-center flex-shrink-0">
          {isCurrentTrack && isPlaying ? (
            <div className="flex justify-center gap-0.5 h-4 items-end">
              {[...Array(3)].map((_, i) => (
                <motion.div 
                  key={i} 
                  className="w-0.5 bg-primary rounded-full"
                  animate={{ height: ['20%', '100%', '20%'] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
          ) : (
            <>
              <span className="text-sm text-muted-foreground group-hover:hidden">
                {index !== undefined ? index + 1 : ''}
              </span>
              <Play 
                size={16} 
                className="hidden group-hover:block mx-auto text-primary" 
                fill="currentColor"
              />
            </>
          )}
        </div>
      )}

      {/* Thumbnail */}
      <div className={cn(
        "relative rounded-lg overflow-hidden flex-shrink-0 shadow-md",
        compact ? "w-10 h-10" : "w-12 h-12"
      )}>
        <img 
          src={track.thumbnailUrl} 
          alt={track.title}
          className="w-full h-full object-cover"
        />
        {!showIndex && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={18} fill="currentColor" className="text-primary" />
          </div>
        )}
        {isDownloaded && (
          <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <Check size={10} className="text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium truncate",
          compact ? "text-sm" : "text-sm",
          isCurrentTrack && "text-primary"
        )}>
          {track.title}
        </p>
        <p className={cn(
          "text-muted-foreground truncate",
          compact ? "text-xs" : "text-xs"
        )}>
          {track.artist}
        </p>
      </div>

      {/* Duration */}
      <span className="text-xs text-muted-foreground flex-shrink-0">{track.duration}</span>

      {/* Actions */}
      <div 
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" 
        onClick={e => e.stopPropagation()}
      >
        {onFavorite && (
          <motion.button 
            className="p-2 hover:bg-muted rounded-full transition-colors"
            onClick={onFavorite}
            whileTap={{ scale: 0.9 }}
          >
            <Heart 
              size={18} 
              className={cn(isFavorite && "fill-primary text-primary")} 
            />
          </motion.button>
        )}
        
        {/* Download button */}
        {onDownload && !isDownloaded && (
          <motion.button 
            className="p-2 hover:bg-muted rounded-full transition-colors"
            onClick={onDownload}
            disabled={isDownloading}
            whileTap={{ scale: 0.9 }}
          >
            {isDownloading ? (
              <div className="relative">
                <Loader2 size={18} className="animate-spin text-primary" />
                {downloadProgress !== undefined && (
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-primary">
                    {Math.round(downloadProgress)}%
                  </span>
                )}
              </div>
            ) : (
              <Download size={18} className="text-muted-foreground hover:text-primary transition-colors" />
            )}
          </motion.button>
        )}

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button 
              className="p-2 hover:bg-muted rounded-full transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <MoreHorizontal size={18} />
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {playlists && playlists.length > 0 && onAddToPlaylist && (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Plus size={16} className="mr-2" />
                    Add to playlist
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {playlists.map((playlist) => (
                      <DropdownMenuItem
                        key={playlist.id}
                        onClick={() => onAddToPlaylist(playlist.id)}
                      >
                        {playlist.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
              </>
            )}
            {isDownloaded && onRemoveDownload && (
              <DropdownMenuItem onClick={onRemoveDownload} className="text-destructive">
                <Trash2 size={16} className="mr-2" />
                Remove download
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
};

interface AlbumCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  onClick?: () => void;
  trackCount?: number;
}

export const AlbumCard = ({ title, subtitle, imageUrl, onClick, trackCount }: AlbumCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 shadow-xl bg-muted">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center kb-gradient-bg">
            <span className="text-4xl font-bold text-primary-foreground">
              {title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <motion.button 
          className="absolute bottom-3 right-3 w-12 h-12 rounded-full kb-gradient-bg flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0"
          whileTap={{ scale: 0.95 }}
        >
          <Play size={24} fill="white" className="text-white ml-0.5" />
        </motion.button>
      </div>
      <h3 className="font-semibold text-sm truncate">{title}</h3>
      <p className="text-xs text-muted-foreground truncate">
        {trackCount !== undefined ? `${trackCount} songs` : subtitle}
      </p>
    </motion.div>
  );
};

interface PlaylistCardProps {
  playlist: Playlist;
  onClick?: () => void;
  onDelete?: () => void;
}

export const PlaylistCard = ({ playlist, onClick, onDelete }: PlaylistCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg bg-muted flex-shrink-0">
        {playlist.coverUrl ? (
          <img 
            src={playlist.coverUrl} 
            alt={playlist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center kb-gradient-bg">
            <span className="text-lg font-bold text-primary-foreground">
              {playlist.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{playlist.name}</p>
        <p className="text-xs text-muted-foreground">
          {playlist.trackCount || 0} songs
        </p>
      </div>
      {onDelete && (
        <motion.button
          className="p-2 hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          whileTap={{ scale: 0.9 }}
        >
          <Trash2 size={16} className="text-destructive" />
        </motion.button>
      )}
    </motion.div>
  );
};
