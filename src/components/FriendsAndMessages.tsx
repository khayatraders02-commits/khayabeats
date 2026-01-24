import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, UserPlus, Check, X, MessageCircle, 
  Send, Loader2, ArrowLeft, Music2, Circle 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Track } from '@/types/music';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  profile?: Profile;
}

interface Friend extends Profile {
  presence?: {
    current_track_data: Track | null;
    is_playing: boolean;
  };
}

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export const FriendsButton = () => {
  const [open, setOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchPending = async () => {
      const { data } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('to_user_id', user.id)
        .eq('status', 'pending');

      if (data) {
        setPendingRequests(data);
      }
    };

    fetchPending();

    const channel = supabase
      .channel('friend-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
          filter: `to_user_id=eq.${user.id}`,
        },
        () => fetchPending()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <motion.button
          className="relative p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          whileTap={{ scale: 0.9 }}
        >
          <Users size={22} />
          {pendingRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center px-1">
              {pendingRequests.length}
            </span>
          )}
        </motion.button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl bg-background/95 backdrop-blur-xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Friends & Messages</SheetTitle>
        </SheetHeader>
        <FriendsContent />
      </SheetContent>
    </Sheet>
  );
};

const FriendsContent = () => {
  const [activeTab, setActiveTab] = useState('friends');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Fetch friendships
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

        const { data: presences } = await supabase
          .from('user_presence')
          .select('user_id, current_track_data, is_playing')
          .in('user_id', friendIds);

        if (profiles) {
          setFriends(profiles.map(p => ({
            ...p,
            presence: presences?.find(pr => pr.user_id === p.id) ? {
              current_track_data: presences.find(pr => pr.user_id === p.id)?.current_track_data as unknown as Track | null,
              is_playing: presences.find(pr => pr.user_id === p.id)?.is_playing || false
            } : undefined
          })));
        }
      }

      // Fetch pending requests TO me
      const { data: pending } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('to_user_id', user.id)
        .eq('status', 'pending');

      if (pending) {
        const fromIds = pending.map(p => p.from_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', fromIds);

        setPendingRequests(pending.map(r => ({
          ...r,
          profile: profiles?.find(p => p.id === r.from_user_id)
        })));
      }

      // Fetch requests I sent
      const { data: sent } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('from_user_id', user.id)
        .eq('status', 'pending');

      if (sent) {
        const toIds = sent.map(s => s.to_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', toIds);

        setSentRequests(sent.map(r => ({
          ...r,
          profile: profiles?.find(p => p.id === r.to_user_id)
        })));
      }
    };

    fetchData();
  }, [user]);

  const searchUsers = async () => {
    if (!searchEmail.trim() || !user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .ilike('display_name', `%${searchEmail}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (toUserId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: user.id,
          to_user_id: toUserId,
        });

      if (error) throw error;

      toast.success('Friend request sent!');
      setSearchResults(prev => prev.filter(p => p.id !== toUserId));
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Request already sent');
      } else {
        toast.error('Failed to send request');
      }
    }
  };

  const respondToRequest = async (requestId: string, accept: boolean) => {
    if (!user) return;

    try {
      const request = pendingRequests.find(r => r.id === requestId);
      if (!request) return;

      if (accept) {
        await supabase.from('friendships').insert({
          user1_id: request.from_user_id,
          user2_id: user.id,
        });
      }

      await supabase
        .from('friend_requests')
        .update({ status: accept ? 'accepted' : 'rejected' })
        .eq('id', requestId);

      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success(accept ? 'Friend added!' : 'Request declined');

      if (accept && request.profile) {
        setFriends(prev => [...prev, request.profile as Friend]);
      }
    } catch (error) {
      console.error('Error responding to request:', error);
      toast.error('Failed to respond to request');
    }
  };

  if (selectedFriend) {
    return (
      <ChatView
        friend={selectedFriend}
        onBack={() => setSelectedFriend(null)}
      />
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <TabsList className="w-full grid grid-cols-3 mb-4 flex-shrink-0">
        <TabsTrigger value="friends">Friends</TabsTrigger>
        <TabsTrigger value="requests" className="relative">
          Requests
          {pendingRequests.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-destructive text-destructive-foreground text-xs rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="add">Add</TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <TabsContent value="friends" className="mt-0 space-y-2 pb-8">
            {friends.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold mb-1">No friends yet</h3>
                <p className="text-sm text-muted-foreground">
                  Search for users to add as friends
                </p>
              </div>
            ) : (
              friends.map((friend) => (
                <motion.button
                  key={friend.id}
                  onClick={() => setSelectedFriend(friend)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={friend.avatar_url || ''} />
                      <AvatarFallback className="kb-gradient-bg text-white">
                        {friend.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    {friend.presence?.is_playing && (
                      <Circle className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 fill-green-500 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{friend.display_name || 'User'}</p>
                    {friend.presence?.current_track_data && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Music2 size={10} />
                        {(friend.presence.current_track_data as Track).title}
                      </p>
                    )}
                  </div>
                  <MessageCircle size={18} className="text-muted-foreground" />
                </motion.button>
              ))
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-0 space-y-4 pb-8">
            {pendingRequests.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Pending Requests</h4>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card"
                    >
                      <Avatar>
                        <AvatarImage src={request.profile?.avatar_url || ''} />
                        <AvatarFallback className="kb-gradient-bg text-white">
                          {request.profile?.display_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{request.profile?.display_name || 'User'}</p>
                        <p className="text-xs text-muted-foreground">wants to be friends</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20"
                          onClick={() => respondToRequest(request.id, true)}
                        >
                          <Check size={18} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                          onClick={() => respondToRequest(request.id, false)}
                        >
                          <X size={18} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sentRequests.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Sent Requests</h4>
                <div className="space-y-2">
                  {sentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card opacity-60"
                    >
                      <Avatar>
                        <AvatarImage src={request.profile?.avatar_url || ''} />
                        <AvatarFallback className="kb-gradient-bg text-white">
                          {request.profile?.display_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{request.profile?.display_name || 'User'}</p>
                        <p className="text-xs text-muted-foreground">Pending...</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingRequests.length === 0 && sentRequests.length === 0 && (
              <div className="text-center py-12">
                <UserPlus className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold mb-1">No requests</h3>
                <p className="text-sm text-muted-foreground">
                  Friend requests will appear here
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="add" className="mt-0 space-y-4 pb-8">
            <div className="flex gap-2">
              <Input
                placeholder="Search by username..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                className="h-11 rounded-xl"
              />
              <Button
                onClick={searchUsers}
                disabled={loading || !searchEmail.trim()}
                className="h-11 px-4"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              </Button>
            </div>

            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-card"
                  >
                    <Avatar>
                      <AvatarImage src={profile.avatar_url || ''} />
                      <AvatarFallback className="kb-gradient-bg text-white">
                        {profile.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{profile.display_name || 'User'}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => sendFriendRequest(profile.id)}
                      className="kb-gradient-bg"
                    >
                      <UserPlus size={16} className="mr-1" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            ) : searchEmail && !loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No users found</p>
              </div>
            ) : null}
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
};

const ChatView = ({ friend, onBack }: { friend: Friend; onBack: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(from_user_id.eq.${user.id},to_user_id.eq.${friend.id}),and(from_user_id.eq.${friend.id},to_user_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data);
        
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('to_user_id', user.id)
          .eq('from_user_id', friend.id);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-${friend.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as Message;
          if (
            (msg.from_user_id === user.id && msg.to_user_id === friend.id) ||
            (msg.from_user_id === friend.id && msg.to_user_id === user.id)
          ) {
            setMessages(prev => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, friend.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        from_user_id: user.id,
        to_user_id: friend.id,
        content: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <Avatar>
          <AvatarImage src={friend.avatar_url || ''} />
          <AvatarFallback className="kb-gradient-bg text-white">
            {friend.display_name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-medium">{friend.display_name || 'User'}</p>
          {friend.presence?.is_playing && (
            <p className="text-xs text-green-500 flex items-center gap-1">
              <Music2 size={10} />
              Listening now
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full py-4">
          <div className="space-y-3 px-1">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Say hi to {friend.display_name}!</p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.from_user_id === user?.id ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-4 py-2.5 rounded-2xl",
                    msg.from_user_id === user?.id
                      ? "kb-gradient-bg text-white rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  )}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={cn(
                    "text-[10px] mt-1",
                    msg.from_user_id === user?.id ? "text-white/70" : "text-muted-foreground"
                  )}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input - Fixed at bottom with proper spacing and safe area */}
      <div className="sticky bottom-0 left-0 right-0 flex gap-3 pt-4 pb-[env(safe-area-inset-bottom,16px)] px-1 border-t border-border bg-background/95 backdrop-blur-sm">
        <Input
          ref={inputRef}
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          className="flex-1 h-12 rounded-2xl px-5 text-base bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/50"
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
          className="h-12 w-12 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg flex-shrink-0 transition-all"
        >
          {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        </Button>
      </div>
    </div>
  );
};

export default FriendsButton;
