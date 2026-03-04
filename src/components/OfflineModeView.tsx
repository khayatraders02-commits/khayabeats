import { WifiOff, Music2 } from 'lucide-react';
import { Track } from '@/types/music';
import { TrackCard } from '@/components/TrackCard';

interface OfflineModeViewProps {
  tracks: Track[];
}

export const OfflineModeView = ({ tracks }: OfflineModeViewProps) => {
  return (
    <div className="space-y-6">
      <div className="kb-glass rounded-2xl p-6 text-center border border-border/50">
        <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
          <WifiOff className="w-7 h-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-1">You’re Offline</h1>
        <p className="text-muted-foreground">Playing your offline backup library</p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Music2 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Offline Backup</h2>
          <span className="text-xs text-muted-foreground">({tracks.length} songs)</span>
        </div>

        {tracks.length > 0 ? (
          <div className="space-y-1">
            {tracks.map((track, index) => (
              <TrackCard key={track.videoId} track={track} index={index} queue={tracks} showIndex compact />
            ))}
          </div>
        ) : (
          <div className="kb-glass rounded-2xl p-8 text-center border border-border/50">
            <p className="text-muted-foreground">No offline songs yet. Go online once to build your backup automatically.</p>
          </div>
        )}
      </section>
    </div>
  );
};
