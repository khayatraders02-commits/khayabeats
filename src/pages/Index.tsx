import { useState, useEffect } from 'react';
import { Home, Search, Library, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { SearchView } from '@/components/SearchView';
import { MiniPlayer, FullPlayer } from '@/components/Player';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Track } from '@/types/music';
import { TrackCard, AlbumCard } from '@/components/TrackCard';
import { toast } from 'sonner';

type Tab = 'home' | 'search' | 'library' | 'profile';

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const { user, signInWithGoogle, signOut, loading } = useAuth();
  const { currentTrack } = usePlayer();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="kb-gradient-text text-3xl font-bold">KhayaBeats</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content */}
      <main className={cn("flex-1 overflow-hidden", currentTrack && "pb-20")}>
        <div className="h-full overflow-y-auto px-4 pt-6 safe-area-top">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && <HomeView key="home" />}
            {activeTab === 'search' && <SearchView key="search" />}
            {activeTab === 'library' && <LibraryView key="library" />}
            {activeTab === 'profile' && (
              <ProfileView 
                key="profile" 
                user={user} 
                onSignIn={signInWithGoogle} 
                onSignOut={signOut} 
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mini Player */}
      {currentTrack && !showFullPlayer && (
        <MiniPlayer onExpand={() => setShowFullPlayer(true)} />
      )}

      {/* Full Player */}
      <AnimatePresence>
        {showFullPlayer && (
          <FullPlayer onCollapse={() => setShowFullPlayer(false)} />
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      {!showFullPlayer && (
        <nav className="fixed bottom-0 left-0 right-0 kb-glass border-t border-border safe-area-bottom" style={{ paddingBottom: currentTrack ? '76px' : undefined }}>
          <div className="flex justify-around items-center py-2">
            {[
              { id: 'home' as Tab, icon: Home, label: 'Home' },
              { id: 'search' as Tab, icon: Search, label: 'Search' },
              { id: 'library' as Tab, icon: Library, label: 'Library' },
              { id: 'profile' as Tab, icon: User, label: 'Profile' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 transition-colors",
                  activeTab === id ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon size={24} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};

const HomeView = () => {
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('recently_played')
        .select('*')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(10);
      
      if (data) {
        setRecentlyPlayed(data.map(r => ({
          id: r.id,
          videoId: r.video_id,
          title: r.title,
          artist: r.artist || 'Unknown',
          thumbnailUrl: r.thumbnail_url || '',
          duration: r.duration || '0:00',
        })));
      }
    };
    
    fetchRecent();
  }, [user]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h1 className="text-3xl font-bold mb-6">
        <span className="kb-gradient-text">KhayaBeats</span>
      </h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Good {getTimeOfDay()}</h2>
        <p className="text-muted-foreground mb-6">
          {user ? `Welcome back!` : 'Sign in to save your music'}
        </p>
      </section>

      {recentlyPlayed.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Recently Played</h2>
          <div className="space-y-1">
            {recentlyPlayed.slice(0, 5).map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} queue={recentlyPlayed} showIndex />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Start Listening</h2>
        <p className="text-muted-foreground">Search for your favorite music to get started!</p>
      </section>
    </motion.div>
  );
};

const LibraryView = () => {
  const [favorites, setFavorites] = useState<Track[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const fetchFavorites = async () => {
      const { data } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) {
        setFavorites(data.map(f => ({
          id: f.id,
          videoId: f.video_id,
          title: f.title,
          artist: f.artist || 'Unknown',
          thumbnailUrl: f.thumbnail_url || '',
          duration: f.duration || '0:00',
        })));
      }
    };
    
    fetchFavorites();
  }, [user]);

  if (!user) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
        <Library className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Your Library</h3>
        <p className="text-muted-foreground">Sign in to see your saved music</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h1 className="text-2xl font-bold mb-6">Your Library</h1>
      
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Favorites ({favorites.length})</h2>
        {favorites.length > 0 ? (
          <div className="space-y-1">
            {favorites.map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} queue={favorites} showIndex />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No favorites yet. Start adding songs!</p>
        )}
      </section>
    </motion.div>
  );
};

const ProfileView = ({ user, onSignIn, onSignOut }: { user: any; onSignIn: () => void; onSignOut: () => void }) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h1 className="text-2xl font-bold mb-6">Profile</h1>
      
      {user ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user.user_metadata?.full_name || 'Music Lover'}</h2>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>
          </div>
          
          <button
            onClick={onSignOut}
            className="w-full py-3 px-4 rounded-xl bg-destructive/10 text-destructive font-medium"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full kb-gradient-bg flex items-center justify-center">
            <User size={40} className="text-primary-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to KhayaBeats</h2>
          <p className="text-muted-foreground mb-6">Save your favorites and sync across devices</p>
          <button
            onClick={onSignIn}
            className="w-full py-3 px-4 rounded-xl kb-gradient-bg text-primary-foreground font-medium"
          >
            Sign in with Google
          </button>
        </div>
      )}
    </motion.div>
  );
};

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

export default Index;
