import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getArtistProfile } from '@/lib/localMusicApi';
import { TrackCard, AlbumCard } from '@/components/TrackCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ArtistProfile = () => {
  const { artistId = '' } = useParams();
  const navigate = useNavigate();
  const { play } = usePlayer();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await getArtistProfile(artistId);
        if (!cancelled) setProfile(data);
      } catch (error) {
        toast.error('Failed to load artist profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <p className="text-muted-foreground">Artist not found.</p>
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
          {profile.image ? (
            <img src={profile.image} alt={profile.name} className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
              {profile.name?.charAt(0) || 'A'}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{profile.name}</h1>
            <p className="text-sm text-muted-foreground">{(profile.monthlyListeners || 0).toLocaleString()} monthly listeners</p>
            {profile.genres?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{profile.genres.join(' • ')}</p>
            )}
          </div>
        </div>
        {profile.bio && <p className="mt-4 text-sm text-muted-foreground">{profile.bio}</p>}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Top Songs</h2>
        <div className="space-y-1">
          {profile.topSongs.map((track: any, index: number) => (
            <TrackCard
              key={track.videoId}
              track={track}
              index={index}
              queue={profile.topSongs}
              showIndex
              compact
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Albums</h2>
        {profile.albums.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {profile.albums.map((album: any) => (
              <AlbumCard
                key={album.id}
                title={album.title}
                subtitle={album.releaseDate ? new Date(album.releaseDate).getFullYear().toString() : 'Album'}
                imageUrl={album.coverImage || ''}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No albums found.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Singles</h2>
        {profile.singles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {profile.singles.map((single: any) => (
              <AlbumCard
                key={single.id}
                title={single.title}
                subtitle={single.releaseDate ? new Date(single.releaseDate).getFullYear().toString() : 'Single'}
                imageUrl={single.coverImage || ''}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No singles found.</p>
        )}
      </section>
    </div>
  );
};

export default ArtistProfile;
