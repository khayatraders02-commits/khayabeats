import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';

export type SleepTimerDuration = 0 | 15 | 30 | 45 | 60 | 90 | 120;

interface SleepTimerState {
  isActive: boolean;
  remainingMinutes: number;
  remainingSeconds: number;
  selectedDuration: SleepTimerDuration;
}

export const useSleepTimer = () => {
  const { pause } = usePlayer();
  const [state, setState] = useState<SleepTimerState>({
    isActive: false,
    remainingMinutes: 0,
    remainingSeconds: 0,
    selectedDuration: 0,
  });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const endTimeRef = useRef<number | null>(null);

  const startTimer = useCallback((minutes: SleepTimerDuration) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (minutes === 0) {
      setState(prev => ({
        ...prev,
        isActive: false,
        remainingMinutes: 0,
        remainingSeconds: 0,
        selectedDuration: 0,
      }));
      endTimeRef.current = null;
      toast.success('Sleep timer cancelled');
      return;
    }
    
    endTimeRef.current = Date.now() + minutes * 60 * 1000;
    
    setState({
      isActive: true,
      remainingMinutes: minutes,
      remainingSeconds: 0,
      selectedDuration: minutes,
    });
    
    toast.success(`Sleep timer set for ${minutes} minutes`);
    
    timerRef.current = setInterval(() => {
      if (!endTimeRef.current) return;
      
      const remaining = endTimeRef.current - Date.now();
      
      if (remaining <= 0) {
        // Time's up - pause the music
        pause();
        toast.info('Sleep timer - Music paused. Goodnight! 😴');
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        setState({
          isActive: false,
          remainingMinutes: 0,
          remainingSeconds: 0,
          selectedDuration: 0,
        });
        endTimeRef.current = null;
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setState(prev => ({
          ...prev,
          remainingMinutes: mins,
          remainingSeconds: secs,
        }));
      }
    }, 1000);
  }, [pause]);

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    endTimeRef.current = null;
    setState({
      isActive: false,
      remainingMinutes: 0,
      remainingSeconds: 0,
      selectedDuration: 0,
    });
    toast.success('Sleep timer cancelled');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startTimer,
    cancelTimer,
    formattedTime: state.isActive 
      ? `${state.remainingMinutes}:${state.remainingSeconds.toString().padStart(2, '0')}` 
      : null,
  };
};
