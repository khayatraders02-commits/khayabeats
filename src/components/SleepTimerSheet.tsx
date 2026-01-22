import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Clock, X, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useSleepTimer, SleepTimerDuration } from '@/hooks/useSleepTimer';
import { cn } from '@/lib/utils';

interface SleepTimerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIMER_OPTIONS: { value: SleepTimerDuration; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export const SleepTimerSheet = ({ open, onOpenChange }: SleepTimerSheetProps) => {
  const { isActive, selectedDuration, formattedTime, startTimer, cancelTimer } = useSleepTimer();

  const handleSelect = (value: SleepTimerDuration) => {
    startTimer(value);
    if (value !== 0) {
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-background/95 backdrop-blur-xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Moon size={20} className="text-primary" />
            Sleep Timer
          </SheetTitle>
        </SheetHeader>

        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={24} className="text-primary" />
                <div>
                  <p className="font-medium">Timer Active</p>
                  <p className="text-2xl font-bold text-primary">{formattedTime}</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={cancelTimer}
                className="p-2 rounded-full bg-destructive/20 text-destructive"
              >
                <X size={20} />
              </motion.button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {TIMER_OPTIONS.map((option) => (
            <motion.button
              key={option.value}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "relative p-4 rounded-xl text-left transition-colors",
                selectedDuration === option.value && isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 hover:bg-muted"
              )}
            >
              <span className="font-medium">{option.label}</span>
              {selectedDuration === option.value && isActive && (
                <Check size={16} className="absolute top-4 right-4" />
              )}
            </motion.button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Music will automatically pause when the timer ends
        </p>
      </SheetContent>
    </Sheet>
  );
};
