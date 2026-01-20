import { useState, useEffect } from 'react';
import { Home, Search, Library, User, Plus, Download, Music2, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { SearchView } from '@/components/SearchView';
import { MiniPlayer, FullPlayer } from '@/components/Player';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Track, Playlist } from '@/types/music';
import { TrackCard, PlaylistCard } from '@/components/TrackCard';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useDownload } from '@/hooks/useDownload';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="kb-gradient-text text-4xl font-bold mb-2">KhayaBeats</div>
          <p className="text-muted-foreground">Loading your music...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className={cn("flex-1 overflow-hidden", currentTrack && "pb-24")}>
        <div className="h-full overflow-y-auto px-4 pt-6 pb-20 safe-area-top">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && <HomeView key="home" />}
            {activeTab === 'search' && <SearchView key="search" />}
            {activeTab === 'library' && <LibraryView key="library" />}
            {activeTab === 'profile' && (
              <ProfileView key="profile" user={user} onSignIn={signInWithGoogle} onSignOut={signOut} />
            )}
          </AnimatePresence>
        </div>
      </main>

      {currentTrack && !showFullPlayer && (
        <MiniPlayer onExpand={() => setShowFullPlayer(true)} />
      )}

      <AnimatePresence>
        {showFullPlayer && <FullPlayer onCollapse={() => setShowFullPlayer(false)} />}
      </AnimatePresence>

      {!showFullPlayer && (
        <nav className="fixed bottom-0 left-0 right-0 kb-glass border-t border-border/50 safe-area-bottom z-30">
          <div className="flex justify-around items-center py-2">
            {[
              { id: 'home' as Tab, icon: Home, label: 'Home' },
              { id: 'search' as Tab, icon: Search, label: 'Search' },
              { id: 'library' as Tab, icon: Library, label: 'Library' },
              { id: 'profile' as Tab, icon: User, label: 'Profile' },
            ].map(({ id, icon: Icon, label }) => (
              <motion.button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 transition-colors rounded-xl",
                  activeTab === id ? "text-primary" : "text-muted-foreground"
                )}
                whileTap={{ scale: 0.95 }}
              >
                <Icon size={24} />
                <span className="text-xs font-medium">{label}</span>
              </motion.button>
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
  const { playlists } = usePlaylist();

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
          id: r.id, videoId: r.video_id, title: r.title,
          artist: r.artist || 'Unknown', thumbnailUrl: r.thumbnail_url || '', duration: r.duration || '0:00',
        })));
      }
    };
    fetchRecent();
  }, [user]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h1 className="text-4xl font-bold mb-2">
        <span className="kb-gradient-text">KhayaBeats</span>
      </h1>
      <p className="text-muted-foreground mb-8">Good {getTimeOfDay()}, {user ? 'welcome back!' : 'start listening'}</p>

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

      {!user && (
        <section className="mb-8 p-6 rounded-2xl kb-glass text-center">
          <Music2 size={48} className="mx-auto text-primary mb-3" />
          <h3 className="text-lg font-semibold mb-2">Sign in to save your music</h3>
          <p className="text-muted-foreground text-sm">Your favorites, playlists, and history sync across devices</p>
        </section>
      )}
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
        <Library className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Your Library</h3>
        <p className="text-muted-foreground">Sign in to see your saved music</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Library</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="kb-gradient-bg"><Plus size={18} className="mr-1" /> New Playlist</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Playlist</DialogTitle></DialogHeader>
            <Input placeholder="Playlist name" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} />
            <Button onClick={handleCreatePlaylist} className="kb-gradient-bg">Create</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['playlists', 'favorites', 'downloads'].map(section => (
          <Button key={section} variant={activeSection === section ? 'default' : 'outline'} size="sm"
            onClick={() => setActiveSection(section as any)} className={activeSection === section ? 'kb-gradient-bg' : ''}>
            {section === 'playlists' && <Music2 size={16} className="mr-1" />}
            {section === 'favorites' && <Heart size={16} className="mr-1" />}
            {section === 'downloads' && <Download size={16} className="mr-1" />}
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </Button>
        ))}
      </div>

      {activeSection === 'playlists' && (
        <div className="space-y-2">
          {playlists.length > 0 ? playlists.map(p => (
            <PlaylistCard key={p.id} playlist={p} onDelete={() => deletePlaylist(p.id)} />
          )) : <p className="text-muted-foreground text-center py-8">No playlists yet</p>}
        </div>
      )}

      {activeSection === 'favorites' && (
        <div className="space-y-1">
          {favorites.length > 0 ? favorites.map((track, i) => (
            <TrackCard key={track.id} track={track} index={i} queue={favorites} showIndex />
          )) : <p className="text-muted-foreground text-center py-8">No favorites yet</p>}
        </div>
      )}

      {activeSection === 'downloads' && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">{(storageUsed / 1024 / 1024).toFixed(1)} MB used</p>
          <div className="space-y-1">
            {downloadedTracks.length > 0 ? downloadedTracks.map((track, i) => (
              <TrackCard key={track.videoId} track={track} index={i} queue={downloadedTracks} showIndex />
            )) : <p className="text-muted-foreground text-center py-8">No downloads yet</p>}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const ProfileView = ({ user, onSignIn, onSignOut }: { user: any; onSignIn: () => void; onSignOut: () => void }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <h1 className="text-2xl font-bold mb-6">Profile</h1>
    {user ? (
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 rounded-2xl kb-glass">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : <User size={28} className="text-primary" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{user.user_metadata?.full_name || 'Music Lover'}</h2>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </div>
        </div>
        <Button onClick={onSignOut} variant="destructive" className="w-full">Sign Out</Button>
      </div>
    ) : (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full kb-gradient-bg flex items-center justify-center">
          <User size={40} className="text-primary-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Sign in to KhayaBeats</h2>
        <p className="text-muted-foreground mb-6">Save your favorites and sync across devices</p>
        <Button onClick={onSignIn} className="w-full kb-gradient-bg">Sign in with Google</Button>
      </div>
    )}
  </motion.div>
);

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

export default Index;
