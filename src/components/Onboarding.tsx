import { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  Music2, Radio, Users, Heart, Download, Mic2, 
  ChevronRight, Sparkles, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OnboardingProps {
  onComplete: () => void;
}

const ONBOARDING_SLIDES = [
  {
    id: 1,
    title: 'Welcome to KhayaBeats',
    description: 'Your personal music streaming experience with millions of songs at your fingertips.',
    icon: Music2,
    color: 'from-primary to-accent',
    bgPattern: 'radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.3), transparent 50%)',
  },
  {
    id: 2,
    title: 'Synced Lyrics',
    description: 'Follow along with real-time synchronized lyrics that highlight as the song plays.',
    icon: Mic2,
    color: 'from-purple-500 to-pink-600',
    bgPattern: 'radial-gradient(circle at 70% 80%, hsl(280 70% 50% / 0.3), transparent 50%)',
  },
  {
    id: 3,
    title: 'Smart Shuffle',
    description: 'AI-powered playlists based on your listening habits and favorite artists.',
    icon: Sparkles,
    color: 'from-amber-500 to-orange-600',
    bgPattern: 'radial-gradient(circle at 20% 60%, hsl(30 90% 50% / 0.3), transparent 50%)',
  },
  {
    id: 4,
    title: 'Jam Sessions',
    description: 'Listen together with friends in real-time. Share the vibe, share the music.',
    icon: Radio,
    color: 'from-emerald-500 to-teal-600',
    bgPattern: 'radial-gradient(circle at 80% 30%, hsl(160 70% 40% / 0.3), transparent 50%)',
  },
  {
    id: 5,
    title: 'Connect & Share',
    description: 'Add friends, chat, and see what everyone is listening to. Music is better together.',
    icon: Users,
    color: 'from-blue-500 to-indigo-600',
    bgPattern: 'radial-gradient(circle at 40% 70%, hsl(220 70% 50% / 0.3), transparent 50%)',
  },
  {
    id: 6,
    title: 'Offline Downloads',
    description: 'Save your favorite tracks and playlists to listen offline, anytime, anywhere.',
    icon: Download,
    color: 'from-rose-500 to-red-600',
    bgPattern: 'radial-gradient(circle at 60% 40%, hsl(350 70% 50% / 0.3), transparent 50%)',
  },
];

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    if (currentSlide < ONBOARDING_SLIDES.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('khayabeats_onboarding_complete', 'true');
    onComplete();
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      handleNext();
    } else if (info.offset.x > threshold) {
      handlePrev();
    }
  };

  const slide = ONBOARDING_SLIDES[currentSlide];
  const Icon = slide.icon;
  const isLastSlide = currentSlide === ONBOARDING_SLIDES.length - 1;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  return (
    <motion.div 
      className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background pattern */}
      <div 
        className="absolute inset-0 transition-all duration-700"
        style={{ background: slide.bgPattern }}
      />

      {/* Skip button */}
      <div className="absolute top-4 right-4 z-10 safe-area-top">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleComplete}
          className="text-muted-foreground hover:text-foreground"
        >
          Skip
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="text-center cursor-grab active:cursor-grabbing"
          >
            {/* Icon */}
            <motion.div
              className={cn(
                "w-32 h-32 mx-auto mb-8 rounded-3xl bg-gradient-to-br flex items-center justify-center shadow-2xl",
                slide.color
              )}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <Icon size={56} className="text-white" />
            </motion.div>

            {/* Title */}
            <motion.h1 
              className="text-3xl font-bold mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {slide.title}
            </motion.h1>

            {/* Description */}
            <motion.p 
              className="text-lg text-muted-foreground max-w-xs mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {slide.description}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom section */}
      <div className="px-8 pb-12 safe-area-bottom">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {ONBOARDING_SLIDES.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => {
                setDirection(index > currentSlide ? 1 : -1);
                setCurrentSlide(index);
              }}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index === currentSlide 
                  ? "w-8 bg-primary" 
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              whileTap={{ scale: 0.9 }}
            />
          ))}
        </div>

        {/* Action button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={handleNext}
            className={cn(
              "w-full h-14 text-lg font-semibold rounded-2xl gap-2 transition-all",
              isLastSlide 
                ? "kb-gradient-bg shadow-xl shadow-primary/30" 
                : "bg-primary/10 hover:bg-primary/20 text-primary"
            )}
          >
            {isLastSlide ? (
              <>
                Get Started
                <ArrowRight size={20} />
              </>
            ) : (
              <>
                Continue
                <ChevronRight size={20} />
              </>
            )}
          </Button>
        </motion.div>

        {/* Swipe hint */}
        <p className="text-center text-xs text-muted-foreground/50 mt-4">
          Swipe left or right to navigate
        </p>
      </div>
    </motion.div>
  );
};

export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('khayabeats_onboarding_complete');
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const completeOnboarding = () => {
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('khayabeats_onboarding_complete');
    setShowOnboarding(true);
  };

  return { showOnboarding, completeOnboarding, resetOnboarding };
};