import { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TrackCard } from '@/components/TrackCard';
import { Track } from '@/types/music';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { GenreBrowser } from '@/components/GenreBrowser';

export const SearchView = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showGenres, setShowGenres] = useState(true);
  const { user } = useAuth();

  // Fetch user's favorites
  useEffect(() => {
    if (!user) return;
    
    const fetchFavorites = async () => {
      const { data } = await supabase
        .from('favorites')
        .select('video_id')
        .eq('user_id', user.id);
      
      if (data) {
        setFavorites(new Set(data.map(f => f.video_id)));
      }
    };
    
    fetchFavorites();
  }, [user]);

  const searchMusic = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowGenres(true);
      return;
    }

    setShowGenres(false);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query: searchQuery },
      });

      if (error) throw error;
      
      setResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchMusic(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, searchMusic]);

  const toggleFavorite = async (track: Track) => {
    if (!user) {
      toast.error('Please sign in to save favorites');
      return;
    }

    const isFavorite = favorites.has(track.videoId);

    try {
      if (isFavorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', track.videoId);
        
        setFavorites(prev => {
          const next = new Set(prev);
          next.delete(track.videoId);
          return next;
        });
        toast.success('Removed from favorites');
      } else {
        await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            video_id: track.videoId,
            title: track.title,
            artist: track.artist,
            thumbnail_url: track.thumbnailUrl,
            duration: track.duration,
          });
        
        setFavorites(prev => new Set(prev).add(track.videoId));
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Favorite error:', error);
      toast.error('Failed to update favorites');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl pb-4">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            type="text"
            placeholder="Search for songs, artists..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-10 h-12 rounded-full bg-muted border-none text-base"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </motion.div>
          ) : results.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-1"
            >
              {results.map((track, index) => (
                <TrackCard
                  key={track.videoId}
                  track={track}
                  index={index}
                  queue={results}
                  showIndex
                  isFavorite={favorites.has(track.videoId)}
                  onFavorite={() => toggleFavorite(track)}
                />
              ))}
            </motion.div>
          ) : query ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 text-muted-foreground"
            >
              No results found for "{query}"
            </motion.div>
          ) : showGenres ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GenreBrowser />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <SearchIcon className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Search for music</h3>
              <p className="text-muted-foreground">Find your favorite songs and artists</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};