import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Loader2, Music2 } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Track } from '@/types/music';
import { supabase } from '@/integrations/supabase/client';
import { TrackCard } from '@/components/TrackCard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Genre {
  id: string;
  name: string;
  color: string;
  searchTerms: string[];
  image?: string;
}

const genres: Genre[] = [
  { 
    id: 'hip-hop', 
    name: 'Hip-Hop', 
    color: 'from-orange-600 to-red-700',
    searchTerms: ['hip hop hits 2024', 'rap music', 'trap beats'],
  },
  { 
    id: 'pop', 
    name: 'Pop', 
    color: 'from-pink-500 to-rose-600',
    searchTerms: ['pop hits 2024', 'top 40 music', 'pop songs'],
  },
  { 
    id: 'rnb', 
    name: 'R&B', 
    color: 'from-purple-600 to-indigo-700',
    searchTerms: ['r&b hits', 'rnb soul music', 'slow jams'],
  },
  { 
    id: 'afrobeats', 
    name: 'Afrobeats', 
    color: 'from-green-500 to-emerald-600',
    searchTerms: ['afrobeats 2024', 'african music hits', 'amapiano'],
  },
  { 
    id: 'latin', 
    name: 'Latin', 
    color: 'from-yellow-500 to-orange-600',
    searchTerms: ['latin music 2024', 'reggaeton hits', 'bachata'],
  },
  { 
    id: 'rock', 
    name: 'Rock', 
    color: 'from-slate-600 to-zinc-700',
    searchTerms: ['rock music', 'rock songs 2024', 'alternative rock'],
  },
  { 
    id: 'electronic', 
    name: 'Electronic', 
    color: 'from-cyan-500 to-blue-600',
    searchTerms: ['edm hits', 'electronic music 2024', 'house music'],
  },
  { 
    id: 'jazz', 
    name: 'Jazz', 
    color: 'from-amber-600 to-yellow-700',
    searchTerms: ['jazz music', 'smooth jazz', 'jazz classics'],
  },
];

interface GenreBrowserProps {
  onClose?: () => void;
  embedded?: boolean;
}

export const GenreBrowser = ({ onClose, embedded = false }: GenreBrowserProps) => {
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { play } = usePlayer();

  const searchGenre = useCallback(async (genre: Genre) => {
    setLoading(true);
    setSelectedGenre(genre);
    setTracks([]);

    try {
      // Search for multiple terms and combine results
      const allTracks: Track[] = [];
      
      for (const term of genre.searchTerms.slice(0, 2)) {
        const { data, error } = await supabase.functions.invoke('youtube-search', {
          body: { query: term },
        });

        if (error) throw error;
        
        if (data.results) {
          allTracks.push(...data.results);
        }
      }

      // Remove duplicates
      const uniqueTracks = allTracks.filter(
        (track, index, self) => index === self.findIndex(t => t.videoId === track.videoId)
      );

      setTracks(uniqueTracks.slice(0, 30));
    } catch (error) {
      console.error('Genre search error:', error);
      toast.error('Failed to load genre tracks');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      play(tracks[0], tracks);
      toast.success(`Playing ${selectedGenre?.name} mix`);
    }
  };

  const handleBack = () => {
    setSelectedGenre(null);
    setTracks([]);
  };

  return (
    <div className={cn("space-y-6", !embedded && "min-h-screen")}>
      <AnimatePresence mode="wait">
        {selectedGenre ? (
          <motion.div
            key="genre-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="relative">
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-30 blur-3xl",
                selectedGenre.color
              )} />
              <div className="relative flex items-center gap-4">
                <motion.button
                  onClick={handleBack}
                  className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                  whileTap={{ scale: 0.9 }}
                >
                  <ArrowLeft size={24} />
                </motion.button>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold">{selectedGenre.name}</h1>
                  <p className="text-muted-foreground">
                    {tracks.length} tracks
                  </p>
                </div>
                <motion.button
                  onClick={handlePlayAll}
                  disabled={loading || tracks.length === 0}
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center shadow-lg",
                    "bg-gradient-to-br text-white",
                    selectedGenre.color
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  {loading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <Play size={24} fill="currentColor" className="ml-1" />
                  )}
                </motion.button>
              </div>
            </div>

            {/* Tracks */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-muted-foreground">Loading {selectedGenre.name} tracks...</p>
                </div>
              </div>
            ) : tracks.length > 0 ? (
              <div className="space-y-1">
                {tracks.map((track, index) => (
                  <TrackCard
                    key={track.videoId}
                    track={track}
                    index={index}
                    queue={tracks}
                    showIndex
                    compact
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Music2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No tracks found</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="genre-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="text-xl font-bold mb-4">Browse Genres</h2>
            <div className="grid grid-cols-2 gap-3">
              {genres.map((genre) => (
                <motion.button
                  key={genre.id}
                  onClick={() => searchGenre(genre)}
                  className={cn(
                    "h-28 rounded-2xl bg-gradient-to-br p-4 cursor-pointer overflow-hidden relative text-left",
                    genre.color
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="font-bold text-white text-lg">{genre.name}</span>
                  <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Play size={18} fill="white" className="text-white ml-0.5" />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Compact genre cards for home screen
export const GenreCards = () => {
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { play } = usePlayer();

  const handleGenreClick = async (genre: Genre) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query: genre.searchTerms[0] },
      });

      if (error) throw error;
      
      if (data.results && data.results.length > 0) {
        play(data.results[0], data.results);
        toast.success(`Playing ${genre.name} mix`);
      }
    } catch (error) {
      console.error('Genre play error:', error);
      toast.error('Failed to play genre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {genres.slice(0, 4).map((genre) => (
        <motion.button
          key={genre.id}
          onClick={() => handleGenreClick(genre)}
          disabled={loading}
          className={cn(
            "h-24 rounded-xl bg-gradient-to-br p-4 cursor-pointer overflow-hidden relative text-left",
            genre.color
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="font-bold text-white">{genre.name}</span>
        </motion.button>
      ))}
    </div>
  );
};

export default GenreBrowser;
