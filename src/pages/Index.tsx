import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Search, Library, Settings, Plus, Download, Music2, Heart, Sparkles, Clock, TrendingUp, BarChart3, Users, MessageCircle, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { SearchView } from '@/components/SearchView';
import { MiniPlayer, FullPlayer } from '@/components/Player';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Track, Playlist } from '@/types/music';
import { TrackCard, PlaylistCard } from '@/components/TrackCard';
import { QuickPlayCard, FeaturedCard, MixCard, SectionHeader } from '@/components/HomeCards';
import { SettingsPage } from '@/components/SettingsPage';
import { StatsPage } from '@/components/StatsPage';
import { FeaturedArtists, FeaturedArtistCircles } from '@/components/ArtistAlbums';
import { SmartShuffleCard } from '@/components/SmartShuffle';
import FriendsButton from '@/components/FriendsAndMessages';
import JamSessionButton from '@/components/JamSession';
import { ContactPage } from '@/components/ContactPage';
import { Onboarding, useOnboarding } from '@/components/Onboarding';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useDownload } from '@/hooks/useDownload';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { NowPlayingBubble } from '@/components/NowPlayingBubble';
import { CuratedPlaylistsSection, FeaturedArtistsSection, GenreGridSection } from '@/components/GenreCards';

type Tab = 'home' | 'search' | 'library' | 'stats' | 'settings' | 'contact';

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const { user, signOut, loading } = useAuth();
  const { currentTrack } = usePlayer();
  const navigate = useNavigate();
  const { showOnboarding, completeOnboarding } = useOnboarding();
  const { requestPermission, isEnabled: notificationsEnabled } = usePushNotifications();

  // Request notification permission after onboarding
  useEffect(() => {
    if (!showOnboarding && user && !notificationsEnabled) {
      // Delay to avoid overwhelming user right after onboarding
      const timer = setTimeout(() => {
        requestPermission();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showOnboarding, user, notificationsEnabled, requestPermission]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div 
            className="w-20 h-20 mx-auto mb-4 rounded-2xl kb-gradient-bg flex items-center justify-center"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Music2 size={40} className="text-white" />
          </motion.div>
          <div className="kb-gradient-text text-3xl font-bold mb-2">KhayaBeats</div>
          <p className="text-muted-foreground">Loading your music...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* Onboarding */}
      <AnimatePresence>
        {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
      </AnimatePresence>

      <div className="min-h-screen bg-background flex flex-col overflow-hidden">
        {/* Ambient background effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </div>

      <main className={cn("flex-1 overflow-hidden relative z-10", currentTrack && "pb-24")}>
        <div className="h-full overflow-y-auto px-4 pt-6 pb-24 safe-area-top">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && <HomeView key="home" setActiveTab={setActiveTab} />}
            {activeTab === 'search' && <SearchView key="search" />}
            {activeTab === 'library' && <LibraryView key="library" />}
            {activeTab === 'stats' && <StatsPage key="stats" />}
            {activeTab === 'settings' && <SettingsPage key="settings" />}
            {activeTab === 'contact' && <ContactPage key="contact" />}
          </AnimatePresence>
        </div>
      </main>

      {/* Now Playing Bubble - Dynamic Island Style */}
      {currentTrack && !showFullPlayer && (
        <>
          <MiniPlayer onExpand={() => setShowFullPlayer(true)} />
          <NowPlayingBubble 
            onClick={() => setShowFullPlayer(true)}
            className="bottom-40 left-4 right-4 mx-auto max-w-sm hidden sm:flex"
          />
        </>
      )}

      <AnimatePresence>
        {showFullPlayer && <FullPlayer onCollapse={() => setShowFullPlayer(false)} />}
      </AnimatePresence>

      {!showFullPlayer && (
        <nav className="fixed bottom-0 left-0 right-0 kb-glass border-t border-border/30 safe-area-bottom z-30">
          <div className="flex justify-around items-center py-2 px-2">
            {[
              { id: 'home' as Tab, icon: Home, label: 'Home' },
              { id: 'search' as Tab, icon: Search, label: 'Search' },
              { id: 'library' as Tab, icon: Library, label: 'Library' },
              { id: 'stats' as Tab, icon: BarChart3, label: 'Stats' },
            ].map(({ id, icon: Icon, label }) => (
              <motion.button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-5 py-2 transition-all rounded-2xl relative",
                  activeTab === id ? "text-primary" : "text-muted-foreground"
                )}
                whileTap={{ scale: 0.9 }}
              >
                {activeTab === id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-primary/10 rounded-2xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon size={22} className="relative z-10" />
                <span className="text-[10px] font-medium relative z-10">{label}</span>
              </motion.button>
            ))}
          </div>
        </nav>
      )}
      </div>
    </>
  );
};

const HomeView = ({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) => {
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const { user } = useAuth();
  const { playlists } = usePlaylist();
  const { play } = usePlayer();
  const navigate = useNavigate();

  // Search and play function for smart shuffle and artist albums
  const searchAndPlay = useCallback(async (query: string): Promise<Track[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query },
      });
      if (error) throw error;
      return data.results || [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }, []);

  const handleSearchAndPlay = useCallback(async (query: string) => {
    const results = await searchAndPlay(query);
    if (results.length > 0) {
      play(results[0], results);
      toast.success(`Playing: ${results[0].title}`);
    }
  }, [searchAndPlay, play]);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      // Fetch recently played
      const { data: recentData } = await supabase
        .from('recently_played')
        .select('*')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(20);
      
      if (recentData) {
        // Remove duplicates by video_id
        const unique = recentData.reduce((acc: Track[], curr) => {
          if (!acc.find(t => t.videoId === curr.video_id)) {
            acc.push({
              id: curr.id,
              videoId: curr.video_id,
              title: curr.title,
              artist: curr.artist || 'Unknown',
              thumbnailUrl: curr.thumbnail_url || '',
              duration: curr.duration || '0:00',
            });
          }
          return acc;
        }, []);
        setRecentlyPlayed(unique.slice(0, 10));
      }

      // Fetch favorites
      const { data: favData } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (favData) {
        setFavorites(favData.map(f => ({
          id: f.id,
          videoId: f.video_id,
          title: f.title,
          artist: f.artist || 'Unknown',
          thumbnailUrl: f.thumbnail_url || '',
          duration: f.duration || '0:00',
        })));
      }
    };
    
    fetchData();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Generate personalized mixes based on listening history
  const personalizedMixes = useMemo(() => {
    if (recentlyPlayed.length === 0) return [];
    
    // Group by artist
    const artistMap = new Map<string, Track[]>();
    [...recentlyPlayed, ...favorites].forEach(track => {
      const existing = artistMap.get(track.artist) || [];
      if (!existing.find(t => t.videoId === track.videoId)) {
        existing.push(track);
      }
      artistMap.set(track.artist, existing);
    });

    // Create mixes from top artists
    return Array.from(artistMap.entries())
      .filter(([_, tracks]) => tracks.length >= 1)
      .slice(0, 4)
      .map(([artist, tracks]) => ({
        title: `${artist} Mix`,
        tracks,
      }));
  }, [recentlyPlayed, favorites]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{getGreeting()}</h1>
          <p className="text-muted-foreground text-sm">
            {user ? 'Ready to discover new music?' : 'Sign in to personalize your experience'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <JamSessionButton />
              <FriendsButton />
              <motion.button 
                onClick={() => setActiveTab('settings')}
                className="w-10 h-10 rounded-full kb-gradient-bg flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <span className="text-white font-bold">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Smart Shuffle Card */}
      {user && (
        <SmartShuffleCard onSearchAndPlay={searchAndPlay} />
      )}

      {/* Quick Play Grid - Like Spotify's top grid */}
      {recentlyPlayed.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {recentlyPlayed.slice(0, 6).map((track) => (
            <QuickPlayCard
              key={track.id}
              title={track.title.length > 25 ? track.title.substring(0, 25) + '...' : track.title}
              subtitle={track.artist}
              imageUrl={track.thumbnailUrl}
              tracks={[track]}
            />
          ))}
        </div>
      )}

      {/* Featured Artists */}
      <FeaturedArtists onSearchAndPlay={handleSearchAndPlay} />

      {/* For You Section */}
      {user && (recentlyPlayed.length > 0 || favorites.length > 0) && (
        <section>
          <SectionHeader 
            title="Made for you" 
            subtitle="Based on your listening"
          />
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {/* Daily Mix */}
              {recentlyPlayed.length > 0 && (
                <div className="w-40 flex-shrink-0">
                  <MixCard
                    title="Daily Mix"
                    tracks={recentlyPlayed}
                    color="from-emerald-500 to-teal-600"
                  />
                </div>
              )}
              
              {/* Favorites Mix */}
              {favorites.length > 0 && (
                <div className="w-40 flex-shrink-0">
                  <MixCard
                    title="Liked Songs"
                    tracks={favorites}
                    color="from-purple-500 to-pink-600"
                  />
                </div>
              )}

              {/* Artist Mixes */}
              {personalizedMixes.map((mix, i) => (
                <div key={i} className="w-40 flex-shrink-0">
                  <MixCard
                    title={mix.title}
                    tracks={mix.tracks}
                    color={i % 2 === 0 ? "from-orange-500 to-red-600" : "from-blue-500 to-indigo-600"}
                  />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>
      )}

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <section>
          <SectionHeader 
            title="Recently Played" 
            subtitle="Jump back in"
          />
          <div className="space-y-1">
            {recentlyPlayed.slice(0, 5).map((track, i) => (
              <TrackCard 
                key={track.id} 
                track={track} 
                index={i} 
                queue={recentlyPlayed} 
                showIndex 
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Your Top Mixes */}
      {playlists.length > 0 && (
        <section>
          <SectionHeader title="Your Playlists" />
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {playlists.map((playlist) => (
                <div key={playlist.id} className="w-40 flex-shrink-0">
                  <FeaturedCard
                    title={playlist.name}
                    subtitle={`${playlist.trackCount || 0} songs`}
                    imageUrl={playlist.coverUrl || ''}
                    type="playlist"
                  />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>
      )}

      {/* Discover Section for new users */}
      {!user && (
        <section className="kb-glass rounded-3xl p-6 text-center">
          <motion.div
            className="w-16 h-16 mx-auto mb-4 rounded-full kb-gradient-bg flex items-center justify-center"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles size={28} className="text-white" />
          </motion.div>
          <h3 className="text-lg font-bold mb-2">Unlock Personalized Music</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Sign in to get personalized playlists, save your favorites, and sync across devices
          </p>
          <Button 
            onClick={() => navigate('/auth')} 
            className="kb-gradient-bg px-8"
          >
            Get Started
          </Button>
        </section>
      )}

      {/* KHAYABEATS AI Curated Playlists */}
      <CuratedPlaylistsSection onGenreSelect={handleSearchAndPlay} />

      {/* Featured Artists with Real Images */}
      <FeaturedArtistsSection onGenreSelect={handleSearchAndPlay} />

      {/* Browse Genres */}
      <GenreGridSection onGenreSelect={handleSearchAndPlay} />
    </motion.div>
  );
};

const LibraryView = () => {
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [activeSection, setActiveSection] = useState<'playlists' | 'favorites' | 'downloads'>('playlists');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const { playlists, createPlaylist, deletePlaylist } = usePlaylist();
  const { downloadedTracks, storageUsed } = useDownload();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fetchFavorites = async () => {
      const { data } = await supabase.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) {
        setFavorites(data.map(f => ({
          id: f.id, videoId: f.video_id, title: f.title,
          artist: f.artist || 'Unknown', thumbnailUrl: f.thumbnail_url || '', duration: f.duration || '0:00',
        })));
      }
    };
    fetchFavorites();
  }, [user]);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    await createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setDialogOpen(false);
  };

  if (!user) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Library className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Your Library</h3>
        <p className="text-muted-foreground mb-6">Sign in to see your saved music</p>
        <Button onClick={() => navigate('/auth')} className="kb-gradient-bg">
          Sign In
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Library</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="kb-gradient-bg gap-1">
              <Plus size={16} /> New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Playlist</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                placeholder="Playlist name" 
                value={newPlaylistName} 
                onChange={e => setNewPlaylistName(e.target.value)} 
              />
              <Button onClick={handleCreatePlaylist} className="w-full kb-gradient-bg">
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'playlists', label: 'Playlists', icon: Music2 },
          { id: 'favorites', label: 'Liked', icon: Heart },
          { id: 'downloads', label: 'Downloads', icon: Download },
        ].map(({ id, label, icon: Icon }) => (
          <motion.button
            key={id}
            onClick={() => setActiveSection(id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeSection === id 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            whileTap={{ scale: 0.95 }}
          >
            <Icon size={16} />
            {label}
          </motion.button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeSection === 'playlists' && (
          <motion.div 
            key="playlists"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-2"
          >
            {playlists.length > 0 ? playlists.map(p => (
              <PlaylistCard key={p.id} playlist={p} onDelete={() => deletePlaylist(p.id)} />
            )) : (
              <div className="text-center py-12 kb-glass rounded-2xl">
                <Music2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No playlists yet</p>
                <p className="text-sm text-muted-foreground/70">Create your first playlist above</p>
              </div>
            )}
          </motion.div>
        )}

        {activeSection === 'favorites' && (
          <motion.div 
            key="favorites"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-1"
          >
            {favorites.length > 0 ? favorites.map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} queue={favorites} showIndex />
            )) : (
              <div className="text-center py-12 kb-glass rounded-2xl">
                <Heart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No liked songs yet</p>
                <p className="text-sm text-muted-foreground/70">Tap the heart on songs you love</p>
              </div>
            )}
          </motion.div>
        )}

        {activeSection === 'downloads' && (
          <motion.div 
            key="downloads"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-sm text-muted-foreground">
                {downloadedTracks.length} songs
              </span>
              <span className="text-sm text-muted-foreground">
                {(storageUsed / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            <div className="space-y-1">
              {downloadedTracks.length > 0 ? downloadedTracks.map((track, i) => (
                <TrackCard key={track.videoId} track={track} index={i} queue={downloadedTracks} showIndex />
              )) : (
                <div className="text-center py-12 kb-glass rounded-2xl">
                  <Download className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No downloads yet</p>
                  <p className="text-sm text-muted-foreground/70">Download songs to listen offline</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Index;
