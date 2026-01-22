import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Shuffle, Heart, Clock, ChevronRight, Music, Disc3 } from 'lucide-react';
import { Track } from '@/types/music';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// Import real concert photos from Pexels
import concert1 from '@/assets/artists/concert-1.jpg';
import concert2 from '@/assets/artists/concert-2.jpg';
import concert3 from '@/assets/artists/concert-3.jpg';
import concert4 from '@/assets/artists/concert-4.jpg';
import concert5 from '@/assets/artists/concert-5.jpg';
import concert6 from '@/assets/artists/concert-6.jpg';

// Popular artist data with their most popular songs
// Using real concert photos from Pexels (royalty-free)
const FEATURED_ARTISTS = [
  {
    id: 'drake',
    name: 'Drake',
    image: concert1,
    gradient: 'from-amber-600 to-orange-800',
    topSongs: [
      'God\'s Plan',
      'One Dance',
      'Hotline Bling',
      'In My Feelings',
      'Started From The Bottom',
      'Nice For What',
      'Passionfruit',
      'Headlines',
      'Hold On We\'re Going Home',
      'HYFR'
    ]
  },
  {
    id: 'weeknd',
    name: 'The Weeknd',
    image: concert2,
    gradient: 'from-red-600 to-rose-900',
    topSongs: [
      'Blinding Lights',
      'Starboy',
      'The Hills',
      'Can\'t Feel My Face',
      'Save Your Tears',
      'I Feel It Coming',
      'Die For You',
      'Call Out My Name',
      'Often',
      'Earned It'
    ]
  },
  {
    id: 'taylor',
    name: 'Taylor Swift',
    image: concert3,
    gradient: 'from-purple-500 to-pink-600',
    topSongs: [
      'Anti-Hero',
      'Shake It Off',
      'Blank Space',
      'Love Story',
      'Cruel Summer',
      'All Too Well',
      'Delicate',
      'Style',
      'Bad Blood',
      'Wildest Dreams'
    ]
  },
  {
    id: 'kendrick',
    name: 'Kendrick Lamar',
    image: concert4,
    gradient: 'from-slate-700 to-slate-900',
    topSongs: [
      'HUMBLE.',
      'Swimming Pools',
      'Money Trees',
      'DNA.',
      'Alright',
      'King Kunta',
      'Bitch Don\'t Kill My Vibe',
      'Poetic Justice',
      'LOYALTY.',
      'All The Stars'
    ]
  },
  {
    id: 'doja',
    name: 'Doja Cat',
    image: concert5,
    gradient: 'from-pink-500 to-fuchsia-700',
    topSongs: [
      'Say So',
      'Kiss Me More',
      'Need to Know',
      'Streets',
      'Woman',
      'Vegas',
      'You Right',
      'Boss Bitch',
      'Mooo!',
      'Juicy'
    ]
  },
  {
    id: 'travis',
    name: 'Travis Scott',
    image: concert6,
    gradient: 'from-orange-700 to-amber-900',
    topSongs: [
      'SICKO MODE',
      'goosebumps',
      'HIGHEST IN THE ROOM',
      'Antidote',
      'Butterfly Effect',
      'FRANCHISE',
      'Pick Up the Phone',
      'Stargazing',
      'The Scotts',
      'Out West'
    ]
  }
];

interface ArtistAlbumCardProps {
  artist: typeof FEATURED_ARTISTS[0];
  onPlay: (searchQuery: string) => void;
}

export const ArtistAlbumCard = ({ artist, onPlay }: ArtistAlbumCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden rounded-2xl cursor-pointer"
      onClick={() => onPlay(`${artist.name} best songs`)}
    >
      {/* Background */}
      <div className={cn("absolute inset-0 bg-gradient-to-br", artist.gradient)} />
      
      {/* Artist Image */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img 
          src={artist.image} 
          alt={artist.name}
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        
        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-lg text-white mb-1">{artist.name}</h3>
          <p className="text-xs text-white/70 mb-3">Top Hits Collection</p>
          
          {/* Play Button */}
          <motion.button
            className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0"
            whileTap={{ scale: 0.9 }}
          >
            <Play size={22} fill="white" className="text-white ml-0.5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

interface ArtistRowProps {
  artist: typeof FEATURED_ARTISTS[0];
  onPlay: (searchQuery: string) => void;
  onSeeAll: () => void;
}

export const ArtistRow = ({ artist, onPlay, onSeeAll }: ArtistRowProps) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg">
            <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-bold">{artist.name}</h3>
            <p className="text-xs text-muted-foreground">Popular tracks</p>
          </div>
        </div>
        <motion.button
          className="flex items-center gap-1 text-sm text-primary"
          onClick={onSeeAll}
          whileTap={{ scale: 0.95 }}
        >
          See all <ChevronRight size={16} />
        </motion.button>
      </div>

      {/* Songs */}
      <div className="space-y-1">
        {artist.topSongs.slice(0, 4).map((song, i) => (
          <motion.div
            key={song}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
            whileTap={{ scale: 0.99 }}
            className="group flex items-center gap-3 p-2 rounded-lg cursor-pointer"
            onClick={() => onPlay(`${artist.name} ${song}`)}
          >
            <span className="w-5 text-center text-xs text-muted-foreground group-hover:hidden">
              {i + 1}
            </span>
            <Play 
              size={14} 
              className="hidden group-hover:block w-5 text-center text-primary" 
              fill="currentColor"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{song}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

interface FeaturedArtistsProps {
  onSearchAndPlay: (query: string) => void;
}

export const FeaturedArtists = ({ onSearchAndPlay }: FeaturedArtistsProps) => {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Popular Artists</h2>
          <p className="text-sm text-muted-foreground">Top hits from trending artists</p>
        </div>
      </div>
      
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {FEATURED_ARTISTS.map((artist, i) => (
            <motion.div
              key={artist.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="w-36 flex-shrink-0"
            >
              <ArtistAlbumCard artist={artist} onPlay={onSearchAndPlay} />
            </motion.div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
};

// Artist circle for horizontal scroll
interface ArtistCircleProps {
  name: string;
  image: string;
  gradient?: string;
  onClick?: () => void;
}

export const ArtistCircle = ({ name, image, gradient, onClick }: ArtistCircleProps) => (
  <motion.button
    whileHover={{ scale: 1.05, y: -4 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="flex flex-col items-center gap-2 w-20"
  >
    <div className="relative">
      <motion.div
        className={cn("absolute -inset-1 rounded-full bg-gradient-to-br opacity-50 blur", gradient || "from-primary to-accent")}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-xl ring-2 ring-border">
        {image ? (
          <img src={image} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className={cn("w-full h-full flex items-center justify-center bg-gradient-to-br", gradient || "from-primary to-accent")}>
            <span className="text-xl font-bold text-white">{name.charAt(0)}</span>
          </div>
        )}
      </div>
    </div>
    <span className="text-xs font-medium text-center truncate w-full">{name}</span>
  </motion.button>
);

export const FeaturedArtistCircles = ({ onSearchAndPlay }: FeaturedArtistsProps) => (
  <section className="space-y-4">
    <h2 className="text-lg font-bold">Favourite Artists</h2>
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4">
        {FEATURED_ARTISTS.map((artist) => (
          <ArtistCircle
            key={artist.id}
            name={artist.name}
            image={artist.image}
            gradient={artist.gradient}
            onClick={() => onSearchAndPlay(`${artist.name} best songs`)}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </section>
);

export { FEATURED_ARTISTS };
