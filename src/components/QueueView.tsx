import { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, GripVertical, Play, Trash2, ListMusic } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Track } from '@/types/music';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QueueViewProps {
  trigger?: React.ReactNode;
}

export const QueueView = ({ trigger }: QueueViewProps) => {
  const { queue, queueIndex, currentTrack, play, removeFromQueue, reorderQueue } = usePlayer();
  const [open, setOpen] = useState(false);

  const upcomingTracks = queue.slice(queueIndex + 1);
  const playedTracks = queue.slice(0, queueIndex);

  const handleReorder = (newOrder: Track[]) => {
    // Reconstruct the full queue with reordered upcoming tracks
    const newQueue = [...playedTracks, currentTrack!, ...newOrder];
    reorderQueue(newQueue);
  };

  const handlePlayTrack = (track: Track, index: number) => {
    // Play from the reordered position
    play(track, queue);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="rounded-full">
            <ListMusic size={22} />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl bg-background/95 backdrop-blur-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl font-bold">Queue</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-full pb-24">
          {/* Now Playing */}
          {currentTrack && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Now Playing</h3>
              <motion.div
                className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20"
                layoutId="current-track"
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={currentTrack.thumbnailUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                    <div className="flex gap-0.5 h-4 items-end">
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-0.5 bg-white rounded-full"
                          animate={{ height: ['20%', '100%', '20%'] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-primary">{currentTrack.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
                </div>
              </motion.div>
            </div>
          )}

          {/* Up Next */}
          {upcomingTracks.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">Up Next</h3>
                <span className="text-xs text-muted-foreground">{upcomingTracks.length} songs</span>
              </div>
              <Reorder.Group
                axis="y"
                values={upcomingTracks}
                onReorder={handleReorder}
                className="space-y-1"
              >
                {upcomingTracks.map((track, index) => (
                  <QueueItem
                    key={track.videoId}
                    track={track}
                    index={index}
                    onPlay={() => handlePlayTrack(track, queueIndex + 1 + index)}
                    onRemove={() => removeFromQueue(queueIndex + 1 + index)}
                  />
                ))}
              </Reorder.Group>
            </div>
          )}

          {/* Previously Played */}
          {playedTracks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Previously Played</h3>
              <div className="space-y-1 opacity-60">
                {playedTracks.map((track, index) => (
                  <motion.div
                    key={`played-${track.videoId}-${index}`}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => play(track, queue)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <img
                      src={track.thumbnailUrl}
                      alt={track.title}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {queue.length === 0 && (
            <div className="text-center py-20">
              <ListMusic className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Queue is empty</h3>
              <p className="text-muted-foreground text-sm">Add songs to your queue to see them here</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

interface QueueItemProps {
  track: Track;
  index: number;
  onPlay: () => void;
  onRemove: () => void;
}

const QueueItem = ({ track, index, onPlay, onRemove }: QueueItemProps) => {
  return (
    <Reorder.Item
      value={track}
      className="flex items-center gap-2 p-2 rounded-xl bg-card hover:bg-muted/50 transition-colors group cursor-grab active:cursor-grabbing"
    >
      <motion.div
        className="p-1 text-muted-foreground cursor-grab"
        whileHover={{ scale: 1.1 }}
      >
        <GripVertical size={18} />
      </motion.div>

      <motion.button
        onClick={onPlay}
        className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
        whileTap={{ scale: 0.95 }}
      >
        <img
          src={track.thumbnailUrl}
          alt={track.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play size={16} fill="currentColor" />
        </div>
      </motion.button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{track.title}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
      </div>

      <span className="text-xs text-muted-foreground mr-2">{track.duration}</span>

      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        whileTap={{ scale: 0.9 }}
      >
        <Trash2 size={16} />
      </motion.button>
    </Reorder.Item>
  );
};

export default QueueView;
