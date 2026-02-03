import { motion } from 'framer-motion';
import { Play, Shuffle } from 'lucide-react';
import { Track } from '@/types/music';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { KhayaBeatsCover } from '@/components/KhayaBeatsCover';

interface QuickPlayCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  tracks?: Track[];
  gradient?: string;
}

export const QuickPlayCard = ({ title, subtitle, imageUrl, tracks, gradient }: QuickPlayCardProps) => {
  const { play } = usePlayer();
  
  const handlePlay = () => {
    if (tracks && tracks.length > 0) {
      play(tracks[0], tracks);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handlePlay}
      className="group relative flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-all overflow-hidden"
    >
      <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0 shadow-lg">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <KhayaBeatsCover title={title} size="sm" className="w-full h-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{title}</p>
      </div>
      <motion.button
        className="absolute right-2 w-10 h-10 rounded-full bg-primary shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          handlePlay();
        }}
      >
        <Play size={18} fill="white" className="text-white ml-0.5" />
      </motion.button>
    </motion.div>
  );
};

interface FeaturedCardProps {
  title: string;
  subtitle: string;
  description?: string;
  imageUrl: string;
  tracks?: Track[];
  large?: boolean;
  type?: 'playlist' | 'album' | 'artist' | 'mix';
}

export const FeaturedCard = ({ title, subtitle, description, imageUrl, tracks, large, type = 'playlist' }: FeaturedCardProps) => {
  const { play } = usePlayer();
  
  const handlePlay = () => {
    if (tracks && tracks.length > 0) {
      play(tracks[0], tracks);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={handlePlay}
      className={cn(
        "group relative rounded-2xl overflow-hidden cursor-pointer shadow-2xl",
        large ? "aspect-[16/9]" : "aspect-square"
      )}
    >
      {/* Background Image or KHAYABEATS Cover */}
      <div className="absolute inset-0">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <KhayaBeatsCover title={title} size="xl" className="w-full h-full rounded-none" />
        )}
      </div>
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      
      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <span className="text-xs font-medium text-primary uppercase tracking-wider mb-1 block">
          {type}
        </span>
        <h3 className="font-bold text-lg leading-tight mb-1 line-clamp-2">{title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-1">{subtitle}</p>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{description}</p>
        )}
      </div>
      
      {/* Play Button */}
      <motion.button
        className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-primary shadow-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0"
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          handlePlay();
        }}
      >
        <Play size={22} fill="white" className="text-white ml-0.5" />
      </motion.button>
    </motion.div>
  );
};

interface MixCardProps {
  title: string;
  tracks: Track[];
  color?: string;
  icon?: React.ReactNode;
}

export const MixCard = ({ title, tracks, color = 'from-primary to-accent' }: MixCardProps) => {
  const { play } = usePlayer();
  
  const handlePlay = () => {
    if (tracks.length > 0) {
      play(tracks[0], tracks);
    }
  };

  const handleShuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      play(shuffled[0], shuffled);
    }
  };

  // Get first 4 track thumbnails for grid
  const thumbnails = tracks.slice(0, 4).map(t => t.thumbnailUrl).filter(Boolean);

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -6 }}
      whileTap={{ scale: 0.98 }}
      onClick={handlePlay}
      className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-xl"
    >
      {/* Thumbnail Grid or KHAYABEATS Cover */}
      <div className="aspect-square relative">
        {thumbnails.length >= 4 ? (
          <div className="grid grid-cols-2 gap-0.5 w-full h-full">
            {thumbnails.slice(0, 4).map((url, i) => (
              <img key={i} src={url} alt="" className="w-full h-full object-cover" />
            ))}
          </div>
        ) : thumbnails.length > 0 ? (
          <img src={thumbnails[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <KhayaBeatsCover title={title} size="xl" className="w-full h-full rounded-none" variant="waves" />
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        
        {/* Play/Shuffle buttons */}
        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
          <motion.button
            className="w-10 h-10 rounded-full bg-muted/80 backdrop-blur-sm flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
            onClick={handleShuffle}
          >
            <Shuffle size={18} />
          </motion.button>
          <motion.button
            className="w-12 h-12 rounded-full bg-primary shadow-xl flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <Play size={22} fill="white" className="text-white ml-0.5" />
          </motion.button>
        </div>
      </div>
      
      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="font-bold text-sm truncate">{title}</h3>
        <p className="text-xs text-muted-foreground">{tracks.length} songs</p>
      </div>
    </motion.div>
  );
};

interface ArtistChipProps {
  name: string;
  imageUrl?: string;
  onClick?: () => void;
}

export const ArtistChip = ({ name, imageUrl, onClick }: ArtistChipProps) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
    >
      <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{name.charAt(0)}</span>
          </div>
        )}
      </div>
      <span className="text-sm font-medium truncate">{name}</span>
    </motion.button>
  );
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

export const SectionHeader = ({ title, subtitle, onSeeAll }: SectionHeaderProps) => {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {onSeeAll && (
        <button 
          onClick={onSeeAll}
          className="text-sm font-medium text-primary hover:underline"
        >
          See all
        </button>
      )}
    </div>
  );
};