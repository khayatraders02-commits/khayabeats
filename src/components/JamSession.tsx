import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radio, Users, Play, Pause, Crown, UserPlus, X, Music2, 
  Loader2, LogOut, Volume2 
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Track } from '@/types/music';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface JamSession {
  id: string;
  host_user_id: string;
  name: string;
  is_active: boolean;
  current_track_data: Track | null;
}

interface Participant {
  id: string;
  user_id: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Friend {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export const JamSessionButton = () => {
  const [open, setOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<JamSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentTrack, isPlaying, play, pause } = usePlayer();

  // Fetch friends who can join
  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user1_id, user2_id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (friendships && friendships.length > 0) {
        const friendIds = friendships.map(f => 
          f.user1_id === user.id ? f.user2_id : f.user1_id
        );

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', friendIds);

        if (profiles) {
          setFriends(profiles);
        }
      }
    };

    fetchFriends();
  }, [user]);

  // Check for active session
  useEffect(() => {
    if (!user) return;

    const checkActiveSession = async () => {
      // Check if user is hosting (use maybeSingle to avoid 406 error)
      const { data: hostingSessions } = await supabase
        .from('jam_sessions')
        .select('*')
        .eq('host_user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      if (hostingSessions && hostingSessions.length > 0) {
        setActiveSession(hostingSessions[0] as unknown as JamSession);
        return;
      }

      // Check if user is participating
      const { data: participatingSessions } = await supabase
        .from('jam_participants')
        .select('jam_session_id')
        .eq('user_id', user.id)
        .limit(1);

      if (participatingSessions && participatingSessions.length > 0) {
        const { data: sessions } = await supabase
          .from('jam_sessions')
          .select('*')
          .eq('id', participatingSessions[0].jam_session_id)
          .eq('is_active', true)
          .limit(1);

        if (sessions && sessions.length > 0) {
          setActiveSession(sessions[0] as unknown as JamSession);
        }
      }
    };

    checkActiveSession();
  }, [user]);

  // Subscribe to session updates
  useEffect(() => {
    if (!activeSession) return;

    const channel = supabase
      .channel(`jam-${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jam_sessions',
          filter: `id=eq.${activeSession.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setActiveSession(payload.new as unknown as JamSession);
            
            // Sync playback
            if (payload.new.current_track_data) {
              play(payload.new.current_track_data as Track);
            }
          } else if (payload.eventType === 'DELETE') {
            setActiveSession(null);
            toast.info('Jam session ended');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jam_participants',
          filter: `jam_session_id=eq.${activeSession.id}`,
        },
        async () => {
          // Refresh participants
          const { data } = await supabase
            .from('jam_participants')
            .select('id, user_id')
            .eq('jam_session_id', activeSession.id);

          if (data) {
            const userIds = data.map(p => p.user_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .in('id', userIds);

            setParticipants(data.map(p => ({
              ...p,
              profile: profiles?.find(pr => pr.id === p.user_id) as Participant['profile']
            })));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession, play]);

  // Update session when track changes (host only)
  useEffect(() => {
    if (!activeSession || !user || activeSession.host_user_id !== user.id) return;

    const updateSessionTrack = async () => {
      await supabase
        .from('jam_sessions')
        .update({
          current_track_id: currentTrack?.videoId,
          current_track_data: currentTrack as unknown as null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeSession.id);
    };

    if (currentTrack) {
      updateSessionTrack();
    }
  }, [currentTrack, activeSession, user]);

  const startJamSession = async () => {
    if (!user) {
      toast.error('Please sign in to start a jam');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jam_sessions')
        .insert([{
          host_user_id: user.id,
          name: sessionName || 'Jam Session',
          current_track_id: currentTrack?.videoId || null,
          current_track_data: currentTrack ? JSON.parse(JSON.stringify(currentTrack)) : null,
        }])
        .select()
        .single();

      if (error) throw error;

      setActiveSession(data as unknown as JamSession);
      toast.success('Jam session started! Invite your friends.');
    } catch (error) {
      console.error('Error starting jam:', error);
      toast.error('Failed to start jam session');
    } finally {
      setLoading(false);
    }
  };

  const endJamSession = async () => {
    if (!activeSession) return;

    try {
      await supabase
        .from('jam_sessions')
        .update({ is_active: false })
        .eq('id', activeSession.id);

      setActiveSession(null);
      toast.success('Jam session ended');
    } catch (error) {
      console.error('Error ending jam:', error);
    }
  };

  const leaveJamSession = async () => {
    if (!activeSession || !user) return;

    try {
      await supabase
        .from('jam_participants')
        .delete()
        .eq('jam_session_id', activeSession.id)
        .eq('user_id', user.id);

      setActiveSession(null);
      toast.success('Left jam session');
    } catch (error) {
      console.error('Error leaving jam:', error);
    }
  };

  const isHost = activeSession?.host_user_id === user?.id;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <motion.button
          className={cn(
            "relative p-2 rounded-full transition-colors",
            activeSession ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
          )}
          whileTap={{ scale: 0.9 }}
        >
          <Radio size={22} />
          {activeSession && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          )}
        </motion.button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl bg-background/95 backdrop-blur-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Radio className="text-primary" size={24} />
            Jam Sessions
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-full pb-24">
          <AnimatePresence mode="wait">
            {activeSession ? (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Active Session */}
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 mx-auto rounded-full kb-gradient-bg flex items-center justify-center">
                    {isHost ? <Crown size={32} className="text-white" /> : <Users size={32} className="text-white" />}
                  </div>
                  <h3 className="text-xl font-bold">{activeSession.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isHost ? "You're hosting" : "You're listening along"}
                  </p>
                </div>

                {/* Now Playing in Jam */}
                {activeSession.current_track_data && (
                  <div className="p-4 rounded-2xl bg-card border border-border">
                    <p className="text-xs text-muted-foreground mb-2">Now Playing</p>
                    <div className="flex items-center gap-3">
                      <img
                        src={(activeSession.current_track_data as Track).thumbnailUrl}
                        alt={(activeSession.current_track_data as Track).title}
                        className="w-14 h-14 rounded-xl object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{(activeSession.current_track_data as Track).title}</p>
                        <p className="text-sm text-muted-foreground truncate">{(activeSession.current_track_data as Track).artist}</p>
                      </div>
                      <div className="flex gap-0.5 h-5 items-end">
                        {[...Array(4)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-1 bg-primary rounded-full"
                            animate={{ height: ['20%', '100%', '20%'] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Participants */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Listening Together ({participants.length + 1})</h4>
                  <div className="flex flex-wrap gap-3">
                    {participants.map((p) => (
                      <div key={p.id} className="flex flex-col items-center">
                        <Avatar className="w-12 h-12 border-2 border-primary/20">
                          <AvatarImage src={p.profile?.avatar_url || ''} />
                          <AvatarFallback className="kb-gradient-bg text-white">
                            {p.profile?.display_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground mt-1 max-w-16 truncate">
                          {p.profile?.display_name || 'User'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4">
                  {isHost ? (
                    <Button
                      onClick={endJamSession}
                      variant="destructive"
                      className="w-full"
                    >
                      End Jam Session
                    </Button>
                  ) : (
                    <Button
                      onClick={leaveJamSession}
                      variant="outline"
                      className="w-full"
                    >
                      <LogOut size={18} className="mr-2" />
                      Leave Session
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Start New Session */}
                <div className="text-center space-y-4 py-6">
                  <div className="w-24 h-24 mx-auto rounded-full bg-muted/30 flex items-center justify-center">
                    <Users size={48} className="text-muted-foreground/50" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Start a Jam Session</h3>
                    <p className="text-sm text-muted-foreground">
                      Listen together with friends in real-time
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Input
                    placeholder="Session name (optional)"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="h-12 rounded-xl"
                  />

                  <Button
                    onClick={startJamSession}
                    disabled={loading || !user}
                    className="w-full h-12 kb-gradient-bg"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin mr-2" size={18} />
                    ) : (
                      <Radio className="mr-2" size={18} />
                    )}
                    Start Jam
                  </Button>

                  {!user && (
                    <p className="text-sm text-center text-muted-foreground">
                      Sign in to start a jam session
                    </p>
                  )}
                </div>

                {/* Friends Section */}
                {friends.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Your Friends</h4>
                    <div className="space-y-2">
                      {friends.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-card"
                        >
                          <Avatar>
                            <AvatarImage src={friend.avatar_url || ''} />
                            <AvatarFallback className="kb-gradient-bg text-white">
                              {friend.display_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{friend.display_name || 'User'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* How it works */}
                <div className="p-4 rounded-2xl bg-muted/30">
                  <h4 className="font-medium mb-2">How Jams Work</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Crown size={14} className="text-primary" />
                      The host controls playback
                    </li>
                    <li className="flex items-center gap-2">
                      <Users size={14} className="text-primary" />
                      Friends join and listen together
                    </li>
                    <li className="flex items-center gap-2">
                      <Volume2 size={14} className="text-primary" />
                      Music syncs in real-time
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default JamSessionButton;
