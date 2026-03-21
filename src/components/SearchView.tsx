import { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, X, Loader2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { TrackCard, AlbumCard } from '@/components/TrackCard';
import { Track } from '@/types/music';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { GenreBrowser } from '@/components/GenreBrowser';
import { searchMusicCatalog, SearchCatalogResponse } from '@/lib/localMusicApi';

const emptySearch: SearchCatalogResponse = {
  artists: [],
  songs: [],
  albums: [],
};

export const SearchView = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchCatalogResponse>(emptySearch);
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
        setFavorites(new Set(data.map((f) => f.video_id)));
      }
    };

    fetchFavorites();
  }, [user]);

  const searchMusic = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(emptySearch);
      setShowGenres(true);
      return;
    }

    setShowGenres(false);
    setLoading(true);
    try {
      const data = await searchMusicCatalog(searchQuery);
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed from both the server and cloud fallback.');
      setResults(emptySearch);
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
        await supabase.from('favorites').delete().eq('user_id', user.id).eq('video_id', track.videoId);

        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(track.videoId);
          return next;
        });
        toast.success('Removed from favorites');
      } else {
        await supabase.from('favorites').insert({
          user_id: user.id,
          video_id: track.videoId,
          title: track.title,
          artist: track.artist,
          thumbnail_url: track.thumbnailUrl,
          duration: track.duration,
        });

        setFavorites((prev) => new Set(prev).add(track.videoId));
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Favorite error:', error);
      toast.error('Failed to update favorites');
    }
  };

  const hasResults = results.artists.length > 0 || results.songs.length > 0 || results.albums.length > 0;

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
          ) : hasResults ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {results.artists.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-muted-foreground mb-2">ARTISTS</h2>
                  <div className="space-y-2">
                    {results.artists.map((artist) => (
                      <button
                        key={artist.id}
                        onClick={() => navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`)}
                        className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
                      >
                        {artist.image ? (
                          <img src={artist.image} alt={artist.name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <UserRound className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{artist.name}</p>
                          <p className="text-xs text-muted-foreground">Artist profile</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {results.songs.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-muted-foreground mb-2">SONGS</h2>
                  <div className="space-y-1">
                    {results.songs.map((track, index) => (
                      <TrackCard
                        key={track.videoId}
                        track={track}
                        index={index}
                        queue={results.songs}
                        showIndex
                        isFavorite={favorites.has(track.videoId)}
                        onFavorite={() => toggleFavorite(track)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {results.albums.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-muted-foreground mb-2">ALBUMS</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {results.albums.map((album) => (
                      <AlbumCard
                        key={album.id}
                        title={album.title}
                        subtitle={album.artist}
                        imageUrl={album.coverImage || ''}
                        onClick={() =>
                          navigate(
                            `/album/${album.id}?title=${encodeURIComponent(album.title)}&artist=${encodeURIComponent(album.artist)}`
                          )
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
