-- Create friend requests table
CREATE TABLE public.friend_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

-- Create friendships table (created when request is accepted)
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create jam sessions table
CREATE TABLE public.jam_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Jam Session',
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_track_id TEXT,
  current_track_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create jam participants table
CREATE TABLE public.jam_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jam_session_id UUID NOT NULL REFERENCES public.jam_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(jam_session_id, user_id)
);

-- Create user presence/currently playing table
CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_track_id TEXT,
  current_track_data JSONB,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Friend requests policies
CREATE POLICY "Users can view requests they sent or received" ON public.friend_requests
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send friend requests" ON public.friend_requests
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update requests they received" ON public.friend_requests
  FOR UPDATE USING (auth.uid() = to_user_id);

CREATE POLICY "Users can delete their sent requests" ON public.friend_requests
  FOR DELETE USING (auth.uid() = from_user_id);

-- Friendships policies
CREATE POLICY "Users can view their friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create friendships" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can delete their friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages policies
CREATE POLICY "Users can view messages they sent or received" ON public.messages
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send messages to friends" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = from_user_id AND
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE (user1_id = auth.uid() AND user2_id = to_user_id)
         OR (user2_id = auth.uid() AND user1_id = to_user_id)
    )
  );

CREATE POLICY "Users can update messages they received" ON public.messages
  FOR UPDATE USING (auth.uid() = to_user_id);

-- Jam sessions policies
CREATE POLICY "Anyone can view active jam sessions" ON public.jam_sessions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can create jam sessions" ON public.jam_sessions
  FOR INSERT WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Host can update their jam sessions" ON public.jam_sessions
  FOR UPDATE USING (auth.uid() = host_user_id);

CREATE POLICY "Host can delete their jam sessions" ON public.jam_sessions
  FOR DELETE USING (auth.uid() = host_user_id);

-- Jam participants policies
CREATE POLICY "Anyone can view jam participants" ON public.jam_participants
  FOR SELECT USING (true);

CREATE POLICY "Friends can join jam sessions" ON public.jam_participants
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.jam_sessions js
      JOIN public.friendships f ON 
        (f.user1_id = auth.uid() AND f.user2_id = js.host_user_id) OR
        (f.user2_id = auth.uid() AND f.user1_id = js.host_user_id)
      WHERE js.id = jam_session_id AND js.is_active = true
    )
  );

CREATE POLICY "Users can leave jam sessions" ON public.jam_participants
  FOR DELETE USING (auth.uid() = user_id);

-- User presence policies
CREATE POLICY "Anyone can view user presence" ON public.user_presence
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own presence" ON public.user_presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence" ON public.user_presence
  FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for jam sessions and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- Allow profiles to be publicly viewable for friend search
CREATE POLICY "Profiles are publicly viewable" ON public.profiles
  FOR SELECT USING (true);

-- Drop the old restrictive select policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;