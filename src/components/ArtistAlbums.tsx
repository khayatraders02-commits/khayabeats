import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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

export const FEATURED_ARTISTS = [
  { id: 'drake', name: 'Drake', image: drakeImage, topSong: "God's Plan" },
  { id: 'beyonce', name: 'Beyoncé', image: beyonceImage, topSong: 'Halo' },
  { id: 'kendrick', name: 'Kendrick Lamar', image: kendrickImage, topSong: 'HUMBLE.' },
  { id: 'chris-brown', name: 'Chris Brown', image: chrisBrownImage, topSong: 'Under The Influence' },
  { id: 'usher', name: 'Usher', image: usherImage, topSong: 'Yeah!' },
  { id: 'rihanna', name: 'Rihanna', image: rihannaImage, topSong: 'Diamonds' },
  { id: 'sza', name: 'SZA', image: szaImage, topSong: 'Snooze' },
  { id: 'taylor', name: 'Taylor Swift', image: taylorSwiftImage, topSong: 'Anti-Hero' },
  { id: 'weeknd', name: 'The Weeknd', image: theWeekndImage, topSong: 'Blinding Lights' },
  { id: 'summer', name: 'Summer Walker', image: summerWalkerImage, topSong: 'Playing Games' },
  { id: 'doja', name: 'Doja Cat', image: dojaCatImage, topSong: 'Say So' },
];

interface FeaturedArtistsProps {
  onSearchAndPlay: (query: string) => void;
}

export const FeaturedArtists = ({ onSearchAndPlay }: FeaturedArtistsProps) => {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Popular Artists</h2>
        <p className="text-sm text-muted-foreground">Official artist images</p>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {FEATURED_ARTISTS.map((artist) => (
            <motion.button
              key={artist.id}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSearchAndPlay(`${artist.name} ${artist.topSong} official audio`)}
              className="group w-36 flex-shrink-0 text-left"
            >
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xl">
                <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <motion.div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play size={18} fill="currentColor" />
                </motion.div>
              </div>
              <p className="mt-2 text-sm font-semibold truncate">{artist.name}</p>
            </motion.button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
};

interface ArtistCircleProps {
  name: string;
  image: string;
  onClick?: () => void;
}

export const ArtistCircle = ({ name, image, onClick }: ArtistCircleProps) => (
  <motion.button
    whileHover={{ scale: 1.05, y: -4 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="flex flex-col items-center gap-2 w-20"
  >
    <div className={cn('relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-border shadow-lg')}>
      <img src={image} alt={name} className="w-full h-full object-cover" />
    </div>
    <span className="text-xs font-medium text-center truncate w-full">{name}</span>
  </motion.button>
);

export const FeaturedArtistCircles = ({ onSearchAndPlay }: FeaturedArtistsProps) => (
  <section className="space-y-4">
    <h2 className="text-lg font-bold">Popular Artists</h2>
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4">
        {FEATURED_ARTISTS.map((artist) => (
          <ArtistCircle
            key={artist.id}
            name={artist.name}
            image={artist.image}
            onClick={() => onSearchAndPlay(`${artist.name} ${artist.topSong} official audio`)}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </section>
);
