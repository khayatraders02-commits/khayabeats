import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePlayer } from '@/contexts/PlayerContext';
import { AlbumProfileResponse, AlbumTrackResult, getAlbumProfile, searchMusicCatalog } from '@/lib/localMusicApi';

const AlbumProfile = () => {
  const { albumId = '' } = useParams();
  const navigate = useNavigate();
  const { play } = usePlayer();

  const [loading, setLoading] = useState(true);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [album, setAlbum] = useState<AlbumProfileResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAlbum = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const title = params.get('title') || undefined;
        const artist = params.get('artist') || undefined;
        const data = await getAlbumProfile(albumId, title, artist);
        if (!cancelled) setAlbum(data);
      } catch {
        if (!cancelled) toast.error('Failed to load album');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAlbum();
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  const playAlbumTrack = async (track: AlbumTrackResult) => {
    try {
      setPlayingTrackId(track.id);
      const result = await searchMusicCatalog(`${track.artist} ${track.title} official audio`);

      if (!result.songs.length) {
        toast.error('No playable source found for this track');
        return;
      }

      const exact = result.songs.find((song) =>
        song.title.toLowerCase().includes(track.title.toLowerCase().slice(0, 12))
      );

      const selected = exact || result.songs[0];
      play(selected, result.songs);
    } catch {
      toast.error('Failed to play track');
    } finally {
      setPlayingTrackId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <section className="kb-glass rounded-2xl p-4 border border-border/50">
        <div className="flex items-center gap-4">
          {album.coverImage ? (
            <img src={album.coverImage} alt={album.title} className="w-24 h-24 rounded-xl object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-2xl font-bold">
              {album.title.charAt(0)}
            </div>
          )}

          <div>
            <h1 className="text-2xl font-bold">{album.title}</h1>
            <p className="text-sm text-muted-foreground">{album.artist}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {album.releaseDate ? new Date(album.releaseDate).getFullYear() : 'Unknown year'} • {album.tracks.length} songs
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Tracks</h2>
        {album.tracks.length > 0 ? (
          <div className="space-y-1">
            {album.tracks
              .slice()
              .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
              .map((track, index) => (
                <button
                  key={track.id}
                  onClick={() => playAlbumTrack(track)}
                  className="w-full text-left p-3 rounded-xl hover:bg-muted/60 transition-colors flex items-center gap-3"
                >
                  <span className="w-6 text-xs text-muted-foreground">{track.trackNumber || index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{track.duration || '0:00'}</span>
                  <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    {playingTrackId === track.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                    )}
                  </span>
                </button>
              ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tracks found for this album.</p>
        )}
      </section>
    </div>
  );
};

export default AlbumProfile;
