import { useState, useCallback, useEffect } from 'react';
import { Playlist, Track } from '@/types/music';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const usePlaylist = () => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: playlistsData, error } = await supabase
        .from('playlists')
        .select(`
          id,
          name,
          cover_url,
          created_at,
          playlist_songs (count)
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formatted: Playlist[] = (playlistsData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        coverUrl: p.cover_url,
        trackCount: p.playlist_songs?.[0]?.count || 0,
        createdAt: new Date(p.created_at),
      }));

      setPlaylists(formatted);
    } catch (error) {
      console.error('Fetch playlists error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const createPlaylist = useCallback(async (name: string): Promise<Playlist | null> => {
    if (!user) {
      toast.error('Sign in to create playlists');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          name,
        })
        .select()
        .single();

      if (error) throw error;

      const newPlaylist: Playlist = {
        id: data.id,
        name: data.name,
        coverUrl: data.cover_url,
        trackCount: 0,
        createdAt: new Date(data.created_at),
      };

      setPlaylists(prev => [newPlaylist, ...prev]);
      toast.success('Playlist created');
      return newPlaylist;
    } catch (error) {
      console.error('Create playlist error:', error);
      toast.error('Failed to create playlist');
      return null;
    }
  }, [user]);

  const deletePlaylist = useCallback(async (playlistId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId);

      if (error) throw error;

      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      toast.success('Playlist deleted');
      return true;
    } catch (error) {
      console.error('Delete playlist error:', error);
      toast.error('Failed to delete playlist');
      return false;
    }
  }, []);

  const renamePlaylist = useCallback(async (playlistId: string, newName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('playlists')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', playlistId);

      if (error) throw error;

      setPlaylists(prev => prev.map(p => 
        p.id === playlistId ? { ...p, name: newName } : p
      ));
      toast.success('Playlist renamed');
      return true;
    } catch (error) {
      console.error('Rename playlist error:', error);
      toast.error('Failed to rename playlist');
      return false;
    }
  }, []);

  const addToPlaylist = useCallback(async (playlistId: string, track: Track): Promise<boolean> => {
    try {
      // Get current max position
      const { data: existingSongs } = await supabase
        .from('playlist_songs')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existingSongs && existingSongs.length > 0 
        ? existingSongs[0].position + 1 
        : 0;

      const { error } = await supabase.from('playlist_songs').insert({
        playlist_id: playlistId,
        video_id: track.videoId,
        title: track.title,
        artist: track.artist,
        thumbnail_url: track.thumbnailUrl,
        duration: track.duration,
        position: nextPosition,
      });

      if (error) throw error;

      // Update track count
      setPlaylists(prev => prev.map(p => 
        p.id === playlistId ? { ...p, trackCount: p.trackCount + 1 } : p
      ));

      // Update cover if first song
      const playlist = playlists.find(p => p.id === playlistId);
      if (playlist && playlist.trackCount === 0) {
        await supabase
          .from('playlists')
          .update({ cover_url: track.thumbnailUrl })
          .eq('id', playlistId);
      }

      toast.success(`Added to ${playlist?.name || 'playlist'}`);
      return true;
    } catch (error) {
      console.error('Add to playlist error:', error);
      toast.error('Failed to add to playlist');
      return false;
    }
  }, [playlists]);

  const removeFromPlaylist = useCallback(async (playlistId: string, videoId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('video_id', videoId);

      if (error) throw error;

      setPlaylists(prev => prev.map(p => 
        p.id === playlistId ? { ...p, trackCount: Math.max(0, p.trackCount - 1) } : p
      ));

      toast.success('Removed from playlist');
      return true;
    } catch (error) {
      console.error('Remove from playlist error:', error);
      toast.error('Failed to remove from playlist');
      return false;
    }
  }, []);

  const getPlaylistTracks = useCallback(async (playlistId: string): Promise<Track[]> => {
    try {
      const { data, error } = await supabase
        .from('playlist_songs')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });

      if (error) throw error;

      return (data || []).map((s: any) => ({
        id: s.id,
        videoId: s.video_id,
        title: s.title,
        artist: s.artist || 'Unknown',
        thumbnailUrl: s.thumbnail_url || '',
        duration: s.duration || '0:00',
      }));
    } catch (error) {
      console.error('Get playlist tracks error:', error);
      return [];
    }
  }, []);

  return {
    playlists,
    loading,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    getPlaylistTracks,
    refreshPlaylists: fetchPlaylists,
  };
};
