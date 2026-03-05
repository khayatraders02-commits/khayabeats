import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePlayer } from '@/contexts/PlayerContext';

export const useBackgroundAudio = () => {
  const { isPlaying, currentTrack } = usePlayer();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setup = async () => {
      try {
        const { BackgroundMode } = await (eval('import("@anuradev/capacitor-background-mode")') as Promise<any>);
        await BackgroundMode.enable({
          title: 'KhayaBeats',
          text: currentTrack ? `${currentTrack.title} • ${currentTrack.artist}` : 'Playing music',
          silent: false,
          resume: true,
          hidden: false,
        });
      } catch {
        // Plugin not available in web
      }
    };

    const teardown = async () => {
      try {
        const { BackgroundMode } = await (eval('import("@anuradev/capacitor-background-mode")') as Promise<any>);
        await BackgroundMode.disable();
      } catch {
        // ignore
      }
    };

    if (isPlaying) {
      setup();
    } else {
      teardown();
    }

    return () => {
      if (!isPlaying) teardown();
    };
  }, [isPlaying, currentTrack?.title, currentTrack?.artist]);
};
