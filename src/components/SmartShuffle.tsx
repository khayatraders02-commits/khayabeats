import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Sparkles, Play, Pause, Music, Zap, Star, TrendingUp, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import { Track } from '@/types/music';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SmartShuffleProps {
  onSearchAndPlay: (query: string) => Promise<Track[]>;
  className?: string;
}

export const SmartShuffleButton = ({ onSearchAndPlay, className }: SmartShuffleProps) => {
  const { user } = useAuth();
  const { play, isPlaying, currentTrack } = usePlayer();
  const [loading, setLoading] = useState(false);
  const [isSmartPlaying, setIsSmartPlaying] = useState(false);

  const startSmartShuffle = async () => {
    if (!user) {
      toast.error('Sign in to use Smart Shuffle');
      return;
    }

    setLoading(true);
    try {
      // Get user's favorites and recently played
      const [{ data: favorites }, { data: recent }] = await Promise.all([
        supabase.from('favorites').select('*').eq('user_id', user.id).limit(50),
        supabase.from('recently_played').select('*').eq('user_id', user.id).order('played_at', { ascending: false }).limit(100),
      ]);

      // Extract unique artists
      const artistCounts = new Map<string, number>();
      [...(favorites || []), ...(recent || [])].forEach(track => {
        const artist = track.artist || 'Unknown';
        artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
      });

      // Get top 5 artists
      const topArtists = Array.from(artistCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      if (topArtists.length === 0) {
        // Fallback to trending music
        const results = await onSearchAndPlay('top hits 2024');
        if (results.length > 0) {
          const shuffled = [...results].sort(() => Math.random() - 0.5);
          play(shuffled[0], shuffled);
          setIsSmartPlaying(true);
          toast.success('Playing trending hits for you!');
        }
        return;
      }

      // Search for music from their favorite artists
      const randomArtist = topArtists[Math.floor(Math.random() * topArtists.length)];
      const results = await onSearchAndPlay(`${randomArtist} songs`);
      
      if (results.length > 0) {
        // Shuffle the results
        const shuffled = [...results].sort(() => Math.random() - 0.5);
        play(shuffled[0], shuffled);
        setIsSmartPlaying(true);
        toast.success(`Playing ${randomArtist} and similar vibes`);
      } else {
        toast.error('Could not find tracks. Try again!');
      }
    } catch (error) {
      console.error('Smart shuffle error:', error);
      toast.error('Smart shuffle failed. Try again!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={startSmartShuffle}
      disabled={loading}
      className={cn(
        "relative overflow-hidden rounded-full px-6 py-3 font-medium text-white shadow-xl",
        "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500",
        "disabled:opacity-70 disabled:cursor-not-allowed",
        className
      )}
    >
      {/* Animated background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400"
        animate={{
          x: loading ? ['0%', '100%', '0%'] : '0%',
        }}
        transition={{
          duration: 1.5,
          repeat: loading ? Infinity : 0,
          ease: 'linear',
        }}
        style={{ opacity: 0.5 }}
      />
      
      <span className="relative flex items-center gap-2">
        {loading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles size={18} />
            </motion.div>
            <span>Finding your vibe...</span>
          </>
        ) : (
          <>
            <Shuffle size={18} />
            <span>Smart Shuffle</span>
            <Sparkles size={14} className="text-white/80" />
          </>
        )}
      </span>
    </motion.button>
  );
};

// Full Smart Shuffle Card component for home screen
interface SmartShuffleCardProps {
  onSearchAndPlay: (query: string) => Promise<Track[]>;
}

export const SmartShuffleCard = ({ onSearchAndPlay }: SmartShuffleCardProps) => {
  const { user } = useAuth();
  const { play } = usePlayer();
  const [loading, setLoading] = useState(false);
  const [topArtists, setTopArtists] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchTopArtists = async () => {
      const { data } = await supabase
        .from('recently_played')
        .select('artist')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(50);

      if (data) {
        const counts = new Map<string, number>();
        data.forEach(d => {
          if (d.artist) {
            counts.set(d.artist, (counts.get(d.artist) || 0) + 1);
          }
        });
        setTopArtists(
          Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name)
        );
      }
    };

    fetchTopArtists();
  }, [user]);

  const handleSmartShuffle = async () => {
    setLoading(true);
    try {
      if (topArtists.length > 0) {
        const randomArtist = topArtists[Math.floor(Math.random() * topArtists.length)];
        const results = await onSearchAndPlay(`${randomArtist} songs`);
        if (results.length > 0) {
          const shuffled = [...results].sort(() => Math.random() - 0.5);
          play(shuffled[0], shuffled);
          toast.success(`Smart shuffle: Playing ${randomArtist}`);
        }
      } else {
        const results = await onSearchAndPlay('top hits 2024');
        if (results.length > 0) {
          const shuffled = [...results].sort(() => Math.random() - 0.5);
          play(shuffled[0], shuffled);
          toast.success('Playing trending hits!');
        }
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="relative overflow-hidden rounded-2xl p-5 cursor-pointer"
      onClick={handleSmartShuffle}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600" />
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'linear-gradient(135deg, rgba(16,185,129,0.8) 0%, rgba(20,184,166,0.8) 50%, rgba(6,182,212,0.8) 100%)',
            'linear-gradient(135deg, rgba(6,182,212,0.8) 0%, rgba(16,185,129,0.8) 50%, rgba(20,184,166,0.8) 100%)',
            'linear-gradient(135deg, rgba(20,184,166,0.8) 0%, rgba(6,182,212,0.8) 50%, rgba(16,185,129,0.8) 100%)',
          ],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Floating particles */}
      <motion.div
        className="absolute top-4 right-8 w-3 h-3 rounded-full bg-white/30"
        animate={{ y: [-5, 5, -5], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-6 right-16 w-2 h-2 rounded-full bg-white/20"
        animate={{ y: [5, -5, 5], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
      />
      
      <div className="relative z-10 flex items-center gap-4">
        {/* Icon */}
        <motion.div
          className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
          animate={loading ? { rotate: 360 } : {}}
          transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: 'linear' }}
        >
          {loading ? (
            <Sparkles size={28} className="text-white" />
          ) : (
            <Zap size={28} className="text-white" />
          )}
        </motion.div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg text-white">Smart Shuffle</h3>
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-medium text-white/90 uppercase">
              AI
            </span>
          </div>
          <p className="text-sm text-white/80">
            {topArtists.length > 0 
              ? `Based on ${topArtists.slice(0, 2).join(', ')}${topArtists.length > 2 ? ' & more' : ''}`
              : 'Play music tailored to your taste'
            }
          </p>
        </div>
        
        <motion.div
          whileTap={{ scale: 0.9 }}
          className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xl"
        >
          <Play size={22} className="text-emerald-600 ml-0.5" fill="currentColor" />
        </motion.div>
      </div>
    </motion.div>
  );
};