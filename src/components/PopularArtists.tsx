import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import artist images
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

export interface PopularArtist {
  id: string;
  name: string;
  image: string;
  query: string;
}

// All popular artists with their real images
export const popularArtists: PopularArtist[] = [
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

interface PopularArtistCardProps {
  artist: PopularArtist;
  onClick?: () => void;
}

export const PopularArtistCard = ({ artist, onClick }: PopularArtistCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group relative flex-shrink-0 cursor-pointer"
    >
      {/* Glow effect */}
      <motion.div
        className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-primary/40 via-accent/30 to-primary/40 blur-xl opacity-0 group-hover:opacity-70 transition-opacity duration-500"
      />
      
      {/* Card */}
      <div className="relative w-36 rounded-2xl overflow-hidden shadow-xl bg-card">
        {/* Image */}
        <div className="aspect-square overflow-hidden">
          <img 
            src={artist.image} 
            alt={artist.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
          
          {/* Play button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="absolute bottom-12 right-2 w-10 h-10 rounded-full bg-primary shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
          >
            <Play size={18} fill="white" className="text-white ml-0.5" />
          </motion.div>
        </div>
        
        {/* Name */}
        <div className="p-3 bg-gradient-to-t from-card to-card/80">
          <h3 className="font-bold text-sm truncate text-center">{artist.name}</h3>
          <p className="text-[10px] text-muted-foreground text-center">Artist</p>
        </div>
      </div>
    </motion.div>
  );
};

interface PopularArtistsSectionProps {
  onArtistSelect?: (query: string) => void;
}

export const PopularArtistsSection = ({ onArtistSelect }: PopularArtistsSectionProps) => {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Popular Artists</h2>
          <p className="text-xs text-muted-foreground">Your favorites, always ready</p>
        </div>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
        {popularArtists.map((artist) => (
          <PopularArtistCard
            key={artist.id}
            artist={artist}
            onClick={() => onArtistSelect?.(artist.query)}
          />
        ))}
      </div>
    </section>
  );
};

export default PopularArtistsSection;
