import { motion } from 'framer-motion';
import { Music } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import all artist images
import drakeImage from '@/assets/artists/drake.png';
import beyonceImage from '@/assets/artists/beyonce.png';
import kendrickImage from '@/assets/artists/kendrick-lamar.png';
import chrisBrownImage from '@/assets/artists/chris-brown.png';
import usherImage from '@/assets/artists/usher.png';
import rihannaImage from '@/assets/artists/rihanna.png';
import szaImage from '@/assets/artists/sza.png';
import taylorSwiftImage from '@/assets/artists/taylor-swift.png';
import theWeekndImage from '@/assets/artists/the-weeknd.png';
import summerWalkerImage from '@/assets/artists/summer-walker.png';
import dojaCatImage from '@/assets/artists/doja-cat.png';

// Genre gradient patterns (Apple Music inspired)
const genreGradients = {
  jazz: 'from-indigo-600 via-purple-500 to-pink-500',
  metal: 'from-blue-600 via-cyan-500 to-blue-400',
  hiphop: 'from-gray-400 via-gray-300 to-red-500',
  queen: 'from-purple-700 via-indigo-600 to-cyan-400',
  lofi: 'from-amber-700 via-orange-600 to-amber-500',
  retro: 'from-purple-600 via-pink-500 to-purple-700',
  rnb: 'from-rose-600 via-pink-500 to-fuchsia-500',
  afrobeats: 'from-green-600 via-emerald-500 to-teal-400',
  pop: 'from-pink-500 via-rose-400 to-orange-400',
  amapiano: 'from-yellow-500 via-amber-400 to-orange-500',
};

interface GenreCardProps {
  title: string;
  subtitle?: string;
  gradient: keyof typeof genreGradients;
  onClick?: () => void;
}

export const GenreCard = ({ title, subtitle, gradient, onClick }: GenreCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-xl",
        "bg-gradient-to-br",
        genreGradients[gradient]
      )}
    >
      {/* Abstract pattern overlay */}
      <div className="absolute inset-0 opacity-30">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id="blur">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
            </filter>
          </defs>
          <ellipse cx="30" cy="70" rx="50" ry="40" fill="white" filter="url(#blur)" opacity="0.3" />
          <ellipse cx="80" cy="30" rx="30" ry="50" fill="white" filter="url(#blur)" opacity="0.2" />
        </svg>
      </div>
      
      {/* KHAYABEATS branding */}
      <div className="absolute top-3 left-3">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
          <span className="text-[10px] font-bold text-white tracking-wider">KHAYABEATS</span>
        </div>
      </div>
      
      {/* Title */}
      <div className="absolute bottom-3 left-3 right-3">
        <h3 className="text-2xl font-bold text-white leading-tight">{title}</h3>
        {subtitle && (
          <p className="text-sm text-white/80">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
};

// Curated playlists for home page
export const curatedPlaylists = [
  { id: 'energy', title: 'Energy', subtitle: 'Top Picks', gradient: 'hiphop' as const, query: 'energetic workout music 2024' },
  { id: 'chill', title: 'Chill Vibes', subtitle: 'Relax', gradient: 'lofi' as const, query: 'chill lofi beats relax' },
  { id: 'happy', title: 'Happy', subtitle: 'Feel Good', gradient: 'pop' as const, query: 'happy feel good songs 2024' },
  { id: 'sad', title: 'Sad', subtitle: 'In Your Feels', gradient: 'rnb' as const, query: 'sad emotional songs r&b' },
  { id: 'focus', title: 'Focus', subtitle: 'Study & Work', gradient: 'jazz' as const, query: 'focus music study concentration' },
  { id: 'party', title: 'Party', subtitle: 'Turn Up', gradient: 'amapiano' as const, query: 'party amapiano dance 2024' },
];

export const genreList = [
  { id: 'hiphop', title: 'Hip-Hop', gradient: 'hiphop' as const, query: 'hip hop rap 2024' },
  { id: 'rnb', title: 'R&B', gradient: 'rnb' as const, query: 'r&b soul 2024' },
  { id: 'afrobeats', title: 'Afrobeats', gradient: 'afrobeats' as const, query: 'afrobeats 2024' },
  { id: 'amapiano', title: 'Amapiano', gradient: 'amapiano' as const, query: 'amapiano 2024' },
  { id: 'pop', title: 'Pop', gradient: 'pop' as const, query: 'pop hits 2024' },
  { id: 'jazz', title: 'Jazz', gradient: 'jazz' as const, query: 'jazz music' },
  { id: 'lofi', title: 'Lo-Fi', gradient: 'lofi' as const, query: 'lofi hip hop beats' },
  { id: 'retro', title: '70s-80s', gradient: 'retro' as const, query: '70s 80s hits classic' },
];

// Featured artists with all real images
export const featuredArtists = [
  { id: 'drake', name: 'Drake', image: drakeImage, query: 'Drake official songs' },
  { id: 'beyonce', name: 'Beyoncé', image: beyonceImage, query: 'Beyonce songs' },
  { id: 'kendrick', name: 'Kendrick Lamar', image: kendrickImage, query: 'Kendrick Lamar songs' },
  { id: 'chris-brown', name: 'Chris Brown', image: chrisBrownImage, query: 'Chris Brown songs' },
  { id: 'usher', name: 'Usher', image: usherImage, query: 'Usher songs' },
  { id: 'rihanna', name: 'Rihanna', image: rihannaImage, query: 'Rihanna songs' },
  { id: 'sza', name: 'SZA', image: szaImage, query: 'SZA official songs' },
  { id: 'taylor', name: 'Taylor Swift', image: taylorSwiftImage, query: 'Taylor Swift songs' },
  { id: 'weeknd', name: 'The Weeknd', image: theWeekndImage, query: 'The Weeknd songs' },
  { id: 'summer', name: 'Summer Walker', image: summerWalkerImage, query: 'Summer Walker songs' },
  { id: 'doja', name: 'Doja Cat', image: dojaCatImage, query: 'Doja Cat songs' },
];

interface FeaturedArtistCardProps {
  name: string;
  image: string;
  onClick?: () => void;
}

export const FeaturedArtistCard = ({ name, image, onClick }: FeaturedArtistCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 cursor-pointer"
    >
      <div className="relative">
        {/* Glow effect */}
        <motion.div
          className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/50 via-accent/50 to-primary/50 blur-md"
          animate={{
            opacity: [0.5, 0.8, 0.5],
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        
        {/* Artist image */}
        <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/20">
          <img 
            src={image} 
            alt={name} 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      
      <span className="text-sm font-medium text-center truncate max-w-[80px]">{name}</span>
    </motion.div>
  );
};

interface GenreBrowserProps {
  onGenreSelect?: (query: string) => void;
}

export const CuratedPlaylistsSection = ({ onGenreSelect }: GenreBrowserProps) => {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10">
          <Music size={14} className="text-primary" />
          <span className="text-xs font-bold text-primary">KHAYABEATS AI</span>
        </div>
        <h2 className="text-lg font-bold">Just For You</h2>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {curatedPlaylists.map((playlist) => (
          <GenreCard
            key={playlist.id}
            title={playlist.title}
            subtitle={playlist.subtitle}
            gradient={playlist.gradient}
            onClick={() => onGenreSelect?.(playlist.query)}
          />
        ))}
      </div>
    </section>
  );
};

export const FeaturedArtistsSection = ({ onGenreSelect }: GenreBrowserProps) => {
  return (
    <section>
      <h2 className="text-lg font-bold mb-4">Featured Artists</h2>
      
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {featuredArtists.map((artist) => (
          <FeaturedArtistCard
            key={artist.id}
            name={artist.name}
            image={artist.image}
            onClick={() => onGenreSelect?.(artist.query)}
          />
        ))}
      </div>
    </section>
  );
};

export const GenreGridSection = ({ onGenreSelect }: GenreBrowserProps) => {
  return (
    <section>
      <h2 className="text-lg font-bold mb-4">Browse Genres</h2>
      
      <div className="grid grid-cols-2 gap-3">
        {genreList.map((genre) => (
          <GenreCard
            key={genre.id}
            title={genre.title}
            gradient={genre.gradient}
            onClick={() => onGenreSelect?.(genre.query)}
          />
        ))}
      </div>
    </section>
  );
};
