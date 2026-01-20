import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, Clock, Music, Disc3, Trophy, Flame, 
  Calendar, ChevronRight, Play, Sparkles, BarChart3,
  Star, Headphones
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import { Track } from '@/types/music';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface ListeningStats {
  totalPlays: number;
  totalMinutes: number;
  topTracks: { track: Track; playCount: number }[];
  topArtists: { name: string; playCount: number; image?: string }[];
  recentStreak: number;
  favoriteGenre?: string;
}

type TimeRange = 'today' | 'week' | 'month' | 'all';

export const StatsPage = () => {
  const { user } = useAuth();
  const { play } = usePlayer();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'tracks' | 'artists'>('overview');

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoading(true);
      
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }

      try {
        // Fetch recently played data
        let query = supabase
          .from('recently_played')
          .select('*')
          .eq('user_id', user.id)
          .order('played_at', { ascending: false });
        
        if (timeRange !== 'all') {
          query = query.gte('played_at', startDate.toISOString());
        }
        
        const { data: plays } = await query.limit(500);

        if (plays && plays.length > 0) {
          // Calculate top tracks
          const trackCounts = new Map<string, { track: Track; count: number }>();
          const artistCounts = new Map<string, { name: string; count: number; image?: string }>();

          plays.forEach(play => {
            // Track counts
            const existing = trackCounts.get(play.video_id);
            if (existing) {
              existing.count++;
            } else {
              trackCounts.set(play.video_id, {
                track: {
                  id: play.id,
                  videoId: play.video_id,
                  title: play.title,
                  artist: play.artist || 'Unknown',
                  thumbnailUrl: play.thumbnail_url || '',
                  duration: play.duration || '0:00',
                },
                count: 1,
              });
            }

            // Artist counts
            const artist = play.artist || 'Unknown';
            const artistExisting = artistCounts.get(artist);
            if (artistExisting) {
              artistExisting.count++;
            } else {
              artistCounts.set(artist, {
                name: artist,
                count: 1,
                image: play.thumbnail_url,
              });
            }
          });

          // Sort and get top 10
          const topTracks = Array.from(trackCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map(t => ({ track: t.track, playCount: t.count }));

          const topArtists = Array.from(artistCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map(a => ({ name: a.name, playCount: a.count, image: a.image }));

          // Calculate total minutes (estimate 3.5 mins per song)
          const totalMinutes = Math.round(plays.length * 3.5);

          // Calculate streak (consecutive days with plays)
          const uniqueDays = new Set(
            plays.map(p => new Date(p.played_at!).toDateString())
          );
          
          setStats({
            totalPlays: plays.length,
            totalMinutes,
            topTracks,
            topArtists,
            recentStreak: uniqueDays.size,
          });
        } else {
          setStats({
            totalPlays: 0,
            totalMinutes: 0,
            topTracks: [],
            topArtists: [],
            recentStreak: 0,
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, timeRange]);

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return `${hours}h ${remaining}m`;
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <BarChart3 className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Your Stats</h3>
        <p className="text-muted-foreground">Sign in to see your listening analytics</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-16 h-16 rounded-full kb-gradient-bg flex items-center justify-center mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <BarChart3 className="w-8 h-8 text-white" />
          </motion.div>
          <p className="text-muted-foreground">Crunching your stats...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl p-6 kb-gradient-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/50" />
        <motion.div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-white/10 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-white/80" />
            <span className="text-sm font-medium text-white/80 uppercase tracking-wider">
              Your Wrapped
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            {timeRange === 'today' ? "Today's" : timeRange === 'week' ? 'This Week' : timeRange === 'month' ? 'This Month' : 'All Time'} Stats
          </h1>
          <p className="text-white/70">
            See what you've been vibing to
          </p>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'This Week' },
          { id: 'month', label: 'This Month' },
          { id: 'all', label: 'All Time' },
        ].map((range) => (
          <motion.button
            key={range.id}
            onClick={() => setTimeRange(range.id as TimeRange)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              timeRange === range.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
            whileTap={{ scale: 0.95 }}
          >
            {range.label}
          </motion.button>
        ))}
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Headphones className="w-5 h-5" />}
          label="Total Plays"
          value={stats?.totalPlays.toString() || '0'}
          color="from-emerald-500 to-teal-600"
          delay={0}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Listening Time"
          value={formatMinutes(stats?.totalMinutes || 0)}
          color="from-purple-500 to-indigo-600"
          delay={0.1}
        />
        <StatCard
          icon={<Star className="w-5 h-5" />}
          label="Top Artists"
          value={(stats?.topArtists.length || 0).toString()}
          color="from-orange-500 to-red-600"
          delay={0.2}
        />
        <StatCard
          icon={<Flame className="w-5 h-5" />}
          label="Day Streak"
          value={`${stats?.recentStreak || 0} days`}
          color="from-pink-500 to-rose-600"
          delay={0.3}
        />
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'tracks', label: 'Top Tracks', icon: Music },
          { id: 'artists', label: 'Top Artists', icon: Disc3 },
        ].map(({ id, label, icon: Icon }) => (
          <motion.button
            key={id}
            onClick={() => setActiveSection(id as typeof activeSection)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeSection === id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            whileTap={{ scale: 0.95 }}
          >
            <Icon size={16} />
            {label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeSection === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Top Track Highlight */}
            {stats?.topTracks[0] && (
              <div className="relative overflow-hidden rounded-2xl p-5 kb-glass">
                <div 
                  className="absolute inset-0 opacity-20 blur-xl"
                  style={{
                    backgroundImage: `url(${stats.topTracks[0].track.thumbnailUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="relative">
                    <motion.div
                      className="absolute -inset-1 rounded-xl kb-gradient-bg opacity-50 blur"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <img
                      src={stats.topTracks[0].track.thumbnailUrl}
                      alt=""
                      className="relative w-20 h-20 rounded-xl object-cover shadow-xl"
                    />
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                      <Trophy className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-primary uppercase tracking-wider">
                      #1 Most Played
                    </span>
                    <h3 className="font-bold text-lg truncate">{stats.topTracks[0].track.title}</h3>
                    <p className="text-sm text-muted-foreground truncate">{stats.topTracks[0].track.artist}</p>
                    <p className="text-xs text-primary mt-1">{stats.topTracks[0].playCount} plays</p>
                  </div>
                  <motion.button
                    className="w-12 h-12 rounded-full kb-gradient-bg flex items-center justify-center shadow-xl"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => play(stats.topTracks[0].track, stats.topTracks.map(t => t.track))}
                  >
                    <Play size={22} fill="white" className="text-white ml-0.5" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* Top 5 Preview */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Top 5 Songs</h3>
                <motion.button
                  className="flex items-center gap-1 text-sm text-primary"
                  onClick={() => setActiveSection('tracks')}
                  whileTap={{ scale: 0.95 }}
                >
                  See all <ChevronRight size={16} />
                </motion.button>
              </div>
              <div className="space-y-2">
                {stats?.topTracks.slice(0, 5).map((item, i) => (
                  <RankedTrackCard
                    key={item.track.videoId}
                    rank={i + 1}
                    track={item.track}
                    playCount={item.playCount}
                    onPlay={() => play(item.track, stats.topTracks.map(t => t.track))}
                  />
                ))}
              </div>
            </div>

            {/* Top Artists Preview */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Top Artists</h3>
                <motion.button
                  className="flex items-center gap-1 text-sm text-primary"
                  onClick={() => setActiveSection('artists')}
                  whileTap={{ scale: 0.95 }}
                >
                  See all <ChevronRight size={16} />
                </motion.button>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {stats?.topArtists.slice(0, 6).map((artist, i) => (
                    <ArtistCard key={artist.name} artist={artist} rank={i + 1} />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </motion.div>
        )}

        {activeSection === 'tracks' && (
          <motion.div
            key="tracks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Top 10 Songs</h3>
              {stats && stats.topTracks.length > 0 && (
                <motion.button
                  className="flex items-center gap-2 px-4 py-2 rounded-full kb-gradient-bg text-sm font-medium text-white"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => play(stats.topTracks[0].track, stats.topTracks.map(t => t.track))}
                >
                  <Play size={16} fill="currentColor" />
                  Play All
                </motion.button>
              )}
            </div>
            {stats?.topTracks.map((item, i) => (
              <RankedTrackCard
                key={item.track.videoId}
                rank={i + 1}
                track={item.track}
                playCount={item.playCount}
                onPlay={() => play(item.track, stats.topTracks.map(t => t.track))}
                showFull
              />
            ))}
            {(!stats?.topTracks || stats.topTracks.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No tracks played yet in this period</p>
              </div>
            )}
          </motion.div>
        )}

        {activeSection === 'artists' && (
          <motion.div
            key="artists"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <h3 className="font-bold text-lg mb-4">Top 10 Artists</h3>
            <div className="grid grid-cols-2 gap-3">
              {stats?.topArtists.map((artist, i) => (
                <ArtistCard key={artist.name} artist={artist} rank={i + 1} large />
              ))}
            </div>
            {(!stats?.topArtists || stats.topArtists.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <Disc3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No artists found in this period</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  delay?: number;
}

const StatCard = ({ icon, label, value, color, delay = 0 }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ scale: 1.02, y: -2 }}
    className="relative overflow-hidden rounded-2xl p-4 kb-glass"
  >
    <div className={cn("absolute -top-6 -right-6 w-16 h-16 rounded-full bg-gradient-to-br blur-xl opacity-50", color)} />
    <div className="relative z-10">
      <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 text-white", color)}>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </motion.div>
);

interface RankedTrackCardProps {
  rank: number;
  track: Track;
  playCount: number;
  onPlay: () => void;
  showFull?: boolean;
}

const RankedTrackCard = ({ rank, track, playCount, onPlay, showFull }: RankedTrackCardProps) => {
  const getRankColor = (r: number) => {
    if (r === 1) return 'from-yellow-400 to-amber-600';
    if (r === 2) return 'from-slate-300 to-slate-500';
    if (r === 3) return 'from-orange-400 to-orange-600';
    return 'from-muted to-muted';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05 }}
      whileHover={{ scale: 1.01, backgroundColor: 'hsl(var(--muted) / 0.5)' }}
      whileTap={{ scale: 0.99 }}
      className="group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
      onClick={onPlay}
    >
      {/* Rank */}
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold bg-gradient-to-br text-white",
        getRankColor(rank)
      )}>
        {rank}
      </div>

      {/* Thumbnail */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-md">
        <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play size={18} fill="currentColor" className="text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{track.title}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
      </div>

      {/* Play count */}
      <div className="text-right">
        <p className="text-sm font-semibold text-primary">{playCount}</p>
        <p className="text-xs text-muted-foreground">plays</p>
      </div>
    </motion.div>
  );
};

interface ArtistCardProps {
  artist: { name: string; playCount: number; image?: string };
  rank: number;
  large?: boolean;
}

const ArtistCard = ({ artist, rank, large }: ArtistCardProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: rank * 0.05 }}
    whileHover={{ scale: 1.03, y: -4 }}
    className={cn(
      "relative overflow-hidden rounded-2xl p-4 kb-glass cursor-pointer",
      large ? "aspect-square flex flex-col items-center justify-center text-center" : "flex-shrink-0 w-28"
    )}
  >
    {/* Background glow */}
    <div 
      className="absolute inset-0 opacity-30 blur-2xl"
      style={{
        backgroundImage: artist.image ? `url(${artist.image})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
    
    <div className="relative z-10">
      {/* Avatar */}
      <div className={cn(
        "rounded-full overflow-hidden mx-auto mb-3 shadow-xl",
        large ? "w-20 h-20" : "w-14 h-14"
      )}>
        {artist.image ? (
          <img src={artist.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full kb-gradient-bg flex items-center justify-center">
            <span className={cn("font-bold text-white", large ? "text-2xl" : "text-lg")}>
              {artist.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Rank badge */}
      {rank <= 3 && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <span className="text-xs font-bold text-white">{rank}</span>
        </div>
      )}

      {/* Info */}
      <p className={cn("font-semibold truncate", large ? "text-base" : "text-xs")}>
        {artist.name}
      </p>
      <p className={cn("text-primary", large ? "text-sm" : "text-xs")}>
        {artist.playCount} plays
      </p>
    </div>
  </motion.div>
);