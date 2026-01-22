import { motion } from 'framer-motion';
import { Disc3, Check, Wifi, Signal, Zap } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAudioQuality, AudioQuality, AUDIO_QUALITY_OPTIONS } from '@/hooks/useAudioQuality';
import { cn } from '@/lib/utils';

interface AudioQualitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUALITY_ICONS: Record<AudioQuality, React.ElementType> = {
  low: Signal,
  medium: Wifi,
  high: Zap,
  auto: Disc3,
};

export const AudioQualitySheet = ({ open, onOpenChange }: AudioQualitySheetProps) => {
  const { quality, setQuality } = useAudioQuality();

  const handleSelect = (newQuality: AudioQuality) => {
    setQuality(newQuality);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-background/95 backdrop-blur-xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Disc3 size={20} className="text-primary" />
            Streaming Quality
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          {(Object.keys(AUDIO_QUALITY_OPTIONS) as AudioQuality[]).map((key) => {
            const option = AUDIO_QUALITY_OPTIONS[key];
            const Icon = QUALITY_ICONS[key];
            const isSelected = quality === key;
            
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(key)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 hover:bg-muted"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  isSelected ? "bg-primary-foreground/20" : "bg-primary/10"
                )}>
                  <Icon size={20} className={isSelected ? "text-primary-foreground" : "text-primary"} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option.label}</span>
                    <span className={cn(
                      "text-sm",
                      isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {option.bitrate}
                    </span>
                  </div>
                  <p className={cn(
                    "text-sm",
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {option.description}
                  </p>
                </div>
                {isSelected && <Check size={20} />}
              </motion.button>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Higher quality uses more data. Use WiFi for best experience.
        </p>
      </SheetContent>
    </Sheet>
  );
};
